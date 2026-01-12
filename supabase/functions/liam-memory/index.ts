import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * LIAM Memory Edge Function
 * 
 * This function handles authenticated requests to the LIAM/NextD Memory API.
 * It implements ECDSA P-256 signature-based authentication as required by the API.
 * 
 * API Documentation: https://web.askbuddy.ai/brain/#/developers
 * 
 * Supported actions:
 * - create: Create a new memory
 * - list: List all memories for the user
 * - forget: Remove a memory
 * - changeTag: Update a memory's tag
 * 
 * Authentication Flow:
 * 1. Verify user is authenticated via Supabase
 * 2. Fetch user's API keys from user_api_keys table
 * 3. Parse PEM private key using Web Crypto API
 * 4. Sign JSON.stringify(requestBody) with ECDSA SHA-256
 * 5. Convert raw 64-byte signature to DER format
 * 6. Base64 encode the DER signature
 * 7. Send request with apiKey and signature headers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API base URL from documentation quick start example
const LIAM_API_BASE = 'https://web.askbuddy.ai/devspacexdb/api';

// Supabase client for fetching user keys
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Convert PEM-formatted private key to CryptoKey
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM header/footer and whitespace
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  // Decode base64 to binary
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Import as ECDSA P-256 private key
  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign']
  );
}

/**
 * Remove leading zeros from byte array (except when next byte has high bit set)
 */
function removeLeadingZeros(arr: number[]): number[] {
  while (arr.length > 1 && arr[0] === 0 && !(arr[1] & 0x80)) {
    arr = arr.slice(1);
  }
  return arr;
}

/**
 * Construct DER length encoding
 */
function constructLength(arr: number[], len: number): void {
  if (len < 0x80) {
    arr.push(len);
  } else {
    const octets = 1 + (Math.log(len) / Math.LN2 >>> 3);
    arr.push(octets | 0x80);
    for (let i = octets - 1; i >= 0; i--) {
      arr.push((len >>> (i * 8)) & 0xff);
    }
  }
}

/**
 * Convert raw ECDSA signature (64 bytes for P-256) to DER format
 * 
 * This follows the exact algorithm from the LIAM API documentation.
 * DER structure: SEQUENCE { INTEGER r, INTEGER s }
 */
function toDER(signature: Uint8Array): string {
  // Split signature into r and s components (32 bytes each for P-256)
  let r = Array.from(signature.slice(0, 32));
  let s = Array.from(signature.slice(32));

  // Add leading zero if high bit is set (to indicate positive number)
  if (r[0] & 0x80) r = [0].concat(r);
  if (s[0] & 0x80) s = [0].concat(s);

  // Remove leading zeros (except one if next byte has high bit)
  r = removeLeadingZeros(r);
  s = removeLeadingZeros(s);

  // Build DER structure: SEQUENCE { INTEGER r, INTEGER s }
  let arr: number[] = [0x02];  // INTEGER tag for r
  constructLength(arr, r.length);
  arr = arr.concat(r);

  arr.push(0x02);  // INTEGER tag for s
  constructLength(arr, s.length);
  arr = arr.concat(s);

  let result: number[] = [0x30];  // SEQUENCE tag
  constructLength(result, arr.length);
  result = result.concat(arr);

  // Base64 encode
  return btoa(String.fromCharCode(...result));
}

/**
 * Sign request body and return base64-encoded DER signature
 */
async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  // Sign the JSON stringified body (as per LIAM docs)
  const encoder = new TextEncoder();
  const dataString = JSON.stringify(body);
  const dataBytes = encoder.encode(dataString);
  
  console.log('Signing data:', dataString);
  
  // Sign with ECDSA SHA-256
  const rawSignature = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    dataBytes
  );
  
  // Convert to DER format and base64 encode
  const signature = toDER(new Uint8Array(rawSignature));
  console.log('Generated signature length:', signature.length);
  
  return signature;
}

/**
 * Make authenticated request to LIAM API
 * Headers: apiKey and signature (lowercase as per docs)
 */
async function makeAuthenticatedRequest(
  endpoint: string,
  method: string,
  body: object,
  apiKey: string,
  privateKey: CryptoKey
): Promise<Response> {
  const signature = await signRequest(privateKey, body);
  
  const url = `${LIAM_API_BASE}${endpoint}`;
  console.log(`Making ${method} request to ${url}`);
  console.log('Request body:', JSON.stringify(body));
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apiKey': apiKey,        // lowercase as per LIAM docs
      'signature': signature,  // lowercase as per LIAM docs
    },
    body: JSON.stringify(body),
  });
  
  return response;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user and get their ID from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Fetch user's API keys from the database
    const { data: userKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('api_key, private_key, user_key')
      .eq('user_id', user.id)
      .single();

    if (keysError || !userKeys) {
      console.error('Failed to fetch user API keys:', keysError);
      return new Response(
        JSON.stringify({ 
          error: 'API keys not configured',
          message: 'Please configure your API keys in your profile settings.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { api_key: apiKey, private_key: privateKeyPem, user_key: userKey } = userKeys;

    // Validate keys are not empty
    if (!apiKey || !privateKeyPem || !userKey) {
      console.error('User API keys are incomplete');
      return new Response(
        JSON.stringify({ 
          error: 'API keys incomplete',
          message: 'One or more API keys are missing. Please update your configuration.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User API keys loaded successfully');
    console.log('API Key (first 10 chars):', apiKey.substring(0, Math.min(10, apiKey.length)) + '...');
    console.log('User Key (first 10 chars):', userKey.substring(0, Math.min(10, userKey.length)) + '...');

    // Import private key with error handling
    let privateKey: CryptoKey;
    try {
      privateKey = await importPrivateKey(privateKeyPem);
      console.log('Private key imported successfully');
    } catch (keyError) {
      console.error('Failed to import private key:', keyError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid private key',
          message: 'The private key format is invalid. Please check your configuration.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user's profile to get their name (for personalized memories)
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single();
    
    const userName = userProfile?.full_name || null;
    console.log('User name from profile:', userName || '(not set)');

    // Parse request
    const { action, content, tag, memoryId, permanent } = await req.json();
    console.log(`LIAM Memory action: ${action}`);

    let response: Response;

    switch (action) {
      case 'create': {
        if (!content) {
          return new Response(
            JSON.stringify({ error: 'Content is required for create action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Personalize content: replace generic references with user's name
        let personalizedContent = content;
        if (userName) {
          // Replace common generic references with the user's name
          personalizedContent = content
            .replace(/\bthe user\b/gi, userName)
            .replace(/\bunrecognized user\b/gi, userName)
            .replace(/\buser's\b/gi, `${userName}'s`)
            .replace(/\bUser's\b/g, `${userName}'s`);
        }

        const createBody: Record<string, string> = {
          userKey,
          content: personalizedContent,
        };
        
        if (tag) {
          // Convert tag to uppercase format (e.g., "family" -> "FAMILY")
          createBody.tag = tag.toUpperCase().replace(/\s+/g, '_');
        }

        console.log('Creating memory with content:', personalizedContent);

        response = await makeAuthenticatedRequest(
          '/memory/create',
          'POST',
          createBody,
          apiKey,
          privateKey
        );
        break;
      }

      case 'list': {
        const listBody = {
          userKey,
        };

        response = await makeAuthenticatedRequest(
          '/memory/list',
          'POST',
          listBody,
          apiKey,
          privateKey
        );
        break;
      }

      case 'forget': {
        if (!memoryId) {
          return new Response(
            JSON.stringify({ error: 'memoryId is required for forget action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // LIAM API documentation shows 'memoryId' but validation expects 'transactionNumber'
        // Send both to ensure compatibility
        const forgetBody: Record<string, any> = {
          userKey,
          memoryId,
          transactionNumber: memoryId,
        };
        
        if (permanent !== undefined) {
          forgetBody.permanent = permanent;
        }
        
        console.log('Forget request body:', JSON.stringify(forgetBody));

        response = await makeAuthenticatedRequest(
          '/memory/forget',
          'POST',
          forgetBody,
          apiKey,
          privateKey
        );
        break;
      }

      case 'changeTag': {
        if (!memoryId) {
          return new Response(
            JSON.stringify({ error: 'memoryId is required for changeTag action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!tag) {
          return new Response(
            JSON.stringify({ error: 'tag is required for changeTag action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const changeTagBody = {
          userKey,
          transactionNumber: memoryId,
          notesKey: tag.toUpperCase().replace(/\s+/g, '_'),
        };

        console.log('ChangeTag request body:', JSON.stringify(changeTagBody));

        response = await makeAuthenticatedRequest(
          '/memory/changeTag',
          'POST',
          changeTagBody,
          apiKey,
          privateKey
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const responseText = await response.text();
    console.log('LIAM API response status:', response.status);
    console.log('LIAM API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'LIAM API error', details: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in liam-memory function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
