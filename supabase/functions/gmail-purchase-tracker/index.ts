import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";

interface Purchase {
  messageId: string;
  vendor: string;
  amount: string;
  date: string;
  subject: string;
}

// Import private key for signing
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContent = pemKey
    .replace(/-----BEGIN (EC )?PRIVATE KEY-----/g, '')
    .replace(/-----END (EC )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

// Convert signature to DER format
function toDER(signature: Uint8Array): string {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);

  const formatInt = (arr: Uint8Array): number[] => {
    const result: number[] = [];
    let i = 0;
    while (i < arr.length - 1 && arr[i] === 0) i++;
    if (arr[i] >= 0x80) result.push(0);
    for (; i < arr.length; i++) result.push(arr[i]);
    return result;
  };

  const rFormatted = formatInt(r);
  const sFormatted = formatInt(s);

  const sequence = [
    0x02, rFormatted.length, ...rFormatted,
    0x02, sFormatted.length, ...sFormatted,
  ];

  const der = new Uint8Array([0x30, sequence.length, ...sequence]);
  return btoa(String.fromCharCode(...der));
}

// Sign the request body
async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const bodyStr = JSON.stringify(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(bodyStr);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  );

  return toDER(new Uint8Array(signature));
}

// Save memory to LIAM
async function saveMemoryToLiam(
  memoryText: string,
  apiKey: string,
  privateKey: string,
  userKey: string
): Promise<boolean> {
  try {
    console.log("Saving purchase memory to LIAM...");
    const cryptoKey = await importPrivateKey(privateKey);

    const requestBody = {
      userKey,
      content: memoryText,
      tag: 'PURCHASE',
    };
    const signature = await signRequest(cryptoKey, requestBody);

    const response = await fetch(`${LIAM_API_BASE}/memory/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey,
        'signature': signature,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LIAM API error:', errorText);
      return false;
    }

    console.log('Purchase memory saved successfully to LIAM');
    return true;
  } catch (error) {
    console.error('Failed to save purchase memory:', error);
    return false;
  }
}

// Extract dollar amount from text
function extractAmount(text: string): string | null {
  const patterns = [
    /\$\s?([\d,]+\.?\d{0,2})/,
    /USD\s?([\d,]+\.?\d{0,2})/i,
    /Total[:\s]*\$?\s?([\d,]+\.\d{2})/i,
    /Amount[:\s]*\$?\s?([\d,]+\.\d{2})/i,
    /Charged[:\s]*\$?\s?([\d,]+\.\d{2})/i,
    /Payment[:\s]*\$?\s?([\d,]+\.\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `$${match[1]}`;
  }
  return null;
}

// Extract vendor name from sender
function extractVendor(from: string, subject: string): string {
  // Try to extract a display name from the "From" header
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    if (name && name.length > 0) return name;
  }
  // Fall back to domain from email
  const emailMatch = from.match(/<([^>]+)>/) || [null, from];
  const email = emailMatch[1] || '';
  const domainMatch = email.match(/@([^.]+)/);
  if (domainMatch) {
    return domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1);
  }
  // Last resort: use subject
  return subject || "Unknown vendor";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header (matches gmail-search pattern)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get optional params
    const body = await req.json().catch(() => ({}));
    const maxResults = Math.min(Math.max(10, body.maxResults || 50), 200);

    // Get user's Gmail connection (matches gmail-search pattern)
    const { data: integration, error: integrationError } = await supabase
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "gmail")
      .eq("status", "connected")
      .single();

    if (integrationError || !integration?.composio_connection_id) {
      throw new Error("Gmail not connected");
    }

    const connectionId = integration.composio_connection_id;
    console.log(`Using connection: ${connectionId}`);

    // Get user's LIAM API keys (matches webhook pattern)
    const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: apiKeys, error: apiKeysError } = await adminClient
      .from('user_api_keys')
      .select('api_key, private_key, user_key')
      .eq('user_id', user.id)
      .single();

    if (apiKeysError || !apiKeys) {
      throw new Error("No API keys configured");
    }

    // Search for purchase/receipt emails via Composio (matches gmail-search pattern)
    const queries = [
      "subject:(receipt OR order confirmation OR purchase OR invoice OR payment)",
      "from:(noreply OR no-reply OR receipt OR orders OR billing OR payments)",
    ];

    const allMessages: Record<string, any> = {};

    for (const query of queries) {
      console.log(`Searching: ${query}`);

      const searchResponse = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY!,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            query: query,
            max_results: maxResults,
          },
        }),
      });

      if (!searchResponse.ok) {
        console.error(`Search failed for query:`, await searchResponse.text());
        continue;
      }

      const searchData = await searchResponse.json();
      console.log(`Search response keys: ${Object.keys(searchData).join(', ')}`);

      // Handle Composio v3 API response format (matches gmail-fetch-emails pattern)
      const responseData = searchData.data || searchData;
      const messages = responseData?.messages || responseData?.results || responseData?.threadsList || responseData?.emails || [];

      console.log(`Found ${messages.length} messages for query`);

      for (const message of messages) {
        const messageId = message.id || message.messageId || message.message_id;
        if (messageId && !allMessages[messageId]) {
          allMessages[messageId] = message;
        }
      }
    }

    console.log(`Total unique messages: ${Object.keys(allMessages).length}`);

    // Parse purchases from messages
    const purchases: Purchase[] = [];
    const seenMessageIds = new Set<string>();

    for (const [messageId, message] of Object.entries(allMessages)) {
      if (seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);

      const from = message.from || message.From || message.sender || "";
      const subject = message.subject || message.Subject || "(No subject)";

      // Handle snippet which may be an object or string (matches gmail-fetch-emails pattern)
      let snippetText = "";
      if (typeof message.snippet === 'object' && message.snippet?.body) {
        snippetText = message.snippet.body;
      } else if (typeof message.snippet === 'string') {
        snippetText = message.snippet;
      } else if (message.preview) {
        snippetText = message.preview;
      }

      // Handle subject from snippet object (matches gmail-fetch-emails pattern)
      let subjectText = subject;
      if (typeof message.snippet === 'object' && message.snippet?.subject) {
        subjectText = message.snippet.subject;
      }

      // Extract full body (matches gmail-fetch-emails priority order)
      let bodyText = "";
      if (message.messageText && typeof message.messageText === 'string') {
        bodyText = message.messageText;
      } else if (message.body && typeof message.body === 'string') {
        bodyText = message.body;
      } else if (message.text && typeof message.text === 'string') {
        bodyText = message.text;
      } else {
        bodyText = snippetText;
      }

      const combinedText = `${subjectText} ${bodyText}`;
      const amount = extractAmount(combinedText);

      if (!amount) continue;

      const vendor = extractVendor(from, subjectText);
      const date = message.date || message.Date || message.internalDate || new Date().toISOString();

      let formattedDate: string;
      try {
        formattedDate = new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        formattedDate = date;
      }

      purchases.push({
        messageId,
        vendor,
        amount,
        date: formattedDate,
        subject: subjectText,
      });
    }

    console.log(`Parsed ${purchases.length} purchases`);

    // Save each purchase as a LIAM memory (matches webhook pattern)
    let savedCount = 0;
    for (const purchase of purchases) {
      const memoryText = `Purchase from ${purchase.vendor} on ${purchase.date}: ${purchase.amount} - "${purchase.subject}"`;
      console.log("Saving memory:", memoryText);

      const saved = await saveMemoryToLiam(
        memoryText,
        apiKeys.api_key,
        apiKeys.private_key,
        apiKeys.user_key
      );
      if (saved) savedCount++;
    }

    console.log(`Saved ${savedCount}/${purchases.length} purchase memories`);

    return new Response(
      JSON.stringify({
        purchases,
        total: purchases.length,
        saved: savedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Purchase tracker error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
