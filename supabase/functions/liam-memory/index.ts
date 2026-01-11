import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
 * 
 * Authentication Flow:
 * 1. Parse PEM private key using Web Crypto API
 * 2. Sign JSON.stringify(requestBody) with ECDSA SHA-256
 * 3. Convert raw 64-byte signature to DER format
 * 4. Base64 encode the DER signature
 * 5. Send request with apiKey and signature headers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API base URL from documentation quick start example
const LIAM_API_BASE = 'https://web.askbuddy.ai/devspacexdb/api';

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
    // Load secrets
    const apiKey = Deno.env.get('LIAM_API_KEY');
    const privateKeyPem = Deno.env.get('LIAM_PRIVATE_KEY');
    const userKey = Deno.env.get('LIAM_USER_KEY');

    if (!apiKey || !privateKeyPem || !userKey) {
      console.error('Missing LIAM credentials. Check LIAM_API_KEY, LIAM_PRIVATE_KEY, and LIAM_USER_KEY secrets.');
      return new Response(
        JSON.stringify({ error: 'LIAM credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('LIAM credentials loaded successfully');
    console.log('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
    console.log('User Key (first 10 chars):', userKey.substring(0, 10) + '...');

    // Import private key
    const privateKey = await importPrivateKey(privateKeyPem);
    console.log('Private key imported successfully');

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

        const createBody: Record<string, string> = {
          userKey,
          content,
        };
        
        if (tag) {
          // Convert tag to uppercase format (e.g., "family" -> "FAMILY")
          createBody.tag = tag.toUpperCase().replace(/\s+/g, '_');
        }

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

        const forgetBody: Record<string, any> = {
          userKey,
          memoryId,
        };
        
        if (permanent !== undefined) {
          forgetBody.permanent = permanent;
        }

        response = await makeAuthenticatedRequest(
          '/memory/forget',
          'POST',
          forgetBody,
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
