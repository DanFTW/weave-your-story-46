import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// LIAM API base URL - using askbuddy proxy which works from edge functions
// Official docs show api.liam.netxd.com but has DNS issues from Supabase
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";

// Original nested payload format
interface EmailPayload {
  from?: string;
  to?: string | string[];
  subject?: string;
  body?: string;
  snippet?: string;
  date?: string;
  messageId?: string;
  threadId?: string;
}

// Composio V3 flat payload format (email data at root level)
interface V3Payload {
  sender?: string;           // "Ben Ornstein <ben@weave.cloud>"
  to?: string;               // "Shane Grady <shane@weave.cloud>"
  subject?: string;
  message_text?: string;     // Body content
  message_timestamp?: string;
  message_id?: string;
  thread_id?: string;
  id?: string;
  label_ids?: string[];
  attachment_list?: unknown[];
  preview?: unknown;
  payload?: unknown;
  trigger_name?: string;
  trigger_id?: string;
  connection_id?: string;
}

// Original nested format
interface NestedPayload {
  trigger_name?: string;
  trigger_id?: string;
  connection_id?: string;
  payload?: EmailPayload;
  metadata?: {
    trigger_name?: string;
  };
}

// Format email as a memory string
function formatEmailAsMemory(email: EmailPayload, isIncoming: boolean): string {
  const date = email.date 
    ? new Date(email.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date';
  
  const body = email.body || email.snippet || '';
  const cleanBody = String(body).replace(/\s+/g, ' ').trim();
  
  if (isIncoming) {
    return `Email from ${email.from} on ${date}: "${email.subject}" - ${cleanBody}`;
  } else {
    const toStr = Array.isArray(email.to) ? email.to.join(', ') : email.to;
    return `Email sent to ${toStr} on ${date}: "${email.subject}" - ${cleanBody}`;
  }
}

// Import private key for signing - handles both PKCS#8 and EC PRIVATE KEY formats
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Handle both PKCS#8 (-----BEGIN PRIVATE KEY-----) and EC (-----BEGIN EC PRIVATE KEY-----) formats
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
    console.log("Importing private key, length:", privateKey.length);
    console.log("Private key format starts with:", privateKey.substring(0, 30));
    
    const cryptoKey = await importPrivateKey(privateKey);
    console.log("Private key imported successfully");
    
    // Body format matches liam-memory edge function: userKey, content, tag
    const requestBody = { 
      userKey, 
      content: memoryText, 
      tag: 'EMAIL' 
    };
    const signature = await signRequest(cryptoKey, requestBody);
    console.log("Request signed successfully");

    const response = await fetch(`${LIAM_API_BASE}/memory/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKey,       // lowercase as per LIAM docs
        'signature': signature, // lowercase as per LIAM docs
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LIAM API error:', errorText);
      return false;
    }

    console.log('Memory saved successfully to LIAM');
    return true;
  } catch (error) {
    console.error('Failed to save memory:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Detect if payload is V3 format (flat structure with message_text, sender, etc.)
function isV3Format(payload: unknown): payload is V3Payload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  // V3 format has message_text and sender at root level
  return 'message_text' in p && 'sender' in p;
}

// Normalize payload to our internal format
function normalizePayload(rawPayload: unknown): {
  emailData: EmailPayload | null;
  triggerName: string | undefined;
  triggerId: string | undefined;
  format: 'v3' | 'nested';
} {
  if (isV3Format(rawPayload)) {
    // V3 format: email data is at root level with different field names
    console.log("Detected V3 (flat) payload format");
    return {
      emailData: {
        from: rawPayload.sender,
        to: rawPayload.to,
        subject: rawPayload.subject,
        body: rawPayload.message_text,
        date: rawPayload.message_timestamp,
        messageId: rawPayload.message_id || rawPayload.id,
        threadId: rawPayload.thread_id,
      },
      triggerName: rawPayload.trigger_name,
      triggerId: rawPayload.trigger_id,
      format: 'v3',
    };
  }

  // Original nested format
  console.log("Detected nested payload format");
  const nested = rawPayload as NestedPayload;
  return {
    emailData: nested.payload || null,
    triggerName: nested.trigger_name || nested.metadata?.trigger_name,
    triggerId: nested.trigger_id,
    format: 'nested',
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check for test mode query parameter
  const url = new URL(req.url);
  const isTestMode = url.searchParams.get("test") === "true";

  console.log("=== Email Automation Webhook ===");
  console.log("Received webhook from Composio", isTestMode ? "(TEST MODE)" : "");
  console.log("Request URL:", req.url);
  console.log("Request method:", req.method);

  try {
    const rawPayload = await req.json();
    console.log("Raw payload keys:", Object.keys(rawPayload));
    console.log("Full payload:", JSON.stringify(rawPayload, null, 2));

    // Normalize payload (handles both V3 and nested formats)
    const { emailData, triggerName, triggerId, format } = normalizePayload(rawPayload);
    
    console.log("Payload format:", format);
    console.log("Trigger name:", triggerName);
    console.log("Trigger ID:", triggerId);
    console.log("Email data present:", !!emailData);
    
    if (emailData) {
      console.log("Email from:", emailData.from);
      console.log("Email to:", emailData.to);
      console.log("Email subject:", emailData.subject);
      console.log("Email body length:", emailData.body?.length || 0);
    }

    // If test mode, just log and return success
    if (isTestMode) {
      console.log("TEST MODE: Webhook received successfully, not processing");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test webhook received",
          testMode: true,
          receivedAt: new Date().toISOString(),
          format,
          payload: {
            trigger_name: triggerName,
            trigger_id: triggerId,
            hasEmailData: !!emailData,
            emailFrom: emailData?.from,
            emailTo: emailData?.to,
            emailSubject: emailData?.subject,
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!emailData) {
      console.log("No email data in payload");
      return new Response(
        JSON.stringify({ success: true, message: "No email data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if this is incoming or outgoing
    const isIncoming = triggerName === "GMAIL_NEW_GMAIL_MESSAGE";
    const isOutgoing = triggerName === "GMAIL_EMAIL_SENT_TRIGGER";

    console.log("Trigger type - isIncoming:", isIncoming, "isOutgoing:", isOutgoing);

    if (!isIncoming && !isOutgoing) {
      console.log("Unknown trigger type:", triggerName);
      return new Response(
        JSON.stringify({ success: true, message: "Unknown trigger type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the user who owns this trigger
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const triggerColumn = isIncoming ? 'incoming_trigger_id' : 'outgoing_trigger_id';
    console.log("Looking up trigger in column:", triggerColumn, "with ID:", triggerId);
    
    const { data: contact, error: contactError } = await adminClient
      .from('email_automation_contacts')
      .select('user_id, email_address')
      .eq(triggerColumn, triggerId)
      .single();

    if (contactError || !contact) {
      console.log("Could not find contact for trigger:", triggerId);
      console.log("Looking in column:", triggerColumn);
      console.log("Contact error:", contactError);
      
      // Log all contacts for debugging
      const { data: allContacts } = await adminClient
        .from('email_automation_contacts')
        .select('email_address, incoming_trigger_id, outgoing_trigger_id');
      console.log("All contacts in database:", JSON.stringify(allContacts, null, 2));
      
      return new Response(
        JSON.stringify({ success: true, message: "Trigger not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found contact: ${contact.email_address} for user: ${contact.user_id}`);

    // Get user's API keys
    const { data: apiKeys, error: apiKeysError } = await adminClient
      .from('user_api_keys')
      .select('api_key, private_key, user_key')
      .eq('user_id', contact.user_id)
      .single();

    if (apiKeysError || !apiKeys) {
      console.log("User has no API keys configured");
      return new Response(
        JSON.stringify({ success: false, message: "No API keys" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format and save the memory
    const memoryText = formatEmailAsMemory(emailData, isIncoming);
    console.log("Saving memory:", memoryText.substring(0, 100) + "...");

    const saved = await saveMemoryToLiam(
      memoryText,
      apiKeys.api_key,
      apiKeys.private_key,
      apiKeys.user_key
    );

    console.log("Memory save result:", saved);

    return new Response(
      JSON.stringify({ 
        success: saved, 
        message: saved ? "Memory saved" : "Failed to save memory",
        email: contact.email_address,
        type: isIncoming ? "incoming" : "outgoing",
        format,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
