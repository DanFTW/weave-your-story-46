import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";

// Normalized email data structure
interface EmailData {
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  date?: string;
  messageId?: string;
  threadId?: string;
}

// Composio wrapped format (current production format)
interface ComposioWrappedPayload {
  id?: string;
  timestamp?: string;
  type?: string;  // "composio.trigger.message"
  metadata?: {
    log_id?: string;
    trigger_slug?: string;  // "GMAIL_NEW_GMAIL_MESSAGE" or "GMAIL_EMAIL_SENT_TRIGGER"
    trigger_id?: string;
    connected_account_id?: string;
  };
  data?: {
    sender?: string;
    to?: string;
    recipients?: string;
    subject?: string;
    message_text?: string;  // For incoming emails
    message_id?: string;
    message_timestamp?: string;
    thread_id?: string;
    payload?: {
      parts?: Array<{
        body?: { data?: string };
        mimeType?: string;
      }>;
    };
  };
}

// Format email as a memory string
function formatEmailAsMemory(email: EmailData, isIncoming: boolean): string {
  const date = email.date 
    ? new Date(email.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date';
  
  const body = email.body || '';
  const cleanBody = String(body).replace(/\s+/g, ' ').trim();
  
  if (isIncoming) {
    return `Email from ${email.from} on ${date}: "${email.subject}" - ${cleanBody}`;
  } else {
    return `Email sent to ${email.to} on ${date}: "${email.subject}" - ${cleanBody}`;
  }
}

// Decode base64 email body
function decodeBase64Body(data: string | undefined): string {
  if (!data) return '';
  try {
    // Replace URL-safe base64 characters
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    return atob(normalized);
  } catch {
    return '';
  }
}

// Extract body from email parts
function extractBodyFromParts(parts?: Array<{ body?: { data?: string }; mimeType?: string }>): string {
  if (!parts || parts.length === 0) return '';
  
  // Prefer text/plain, fall back to text/html
  const textPart = parts.find(p => p.mimeType === 'text/plain');
  const htmlPart = parts.find(p => p.mimeType === 'text/html');
  
  const part = textPart || htmlPart;
  if (part?.body?.data) {
    const decoded = decodeBase64Body(part.body.data);
    // Strip HTML tags if it was HTML
    if (htmlPart && !textPart) {
      return decoded.replace(/<[^>]*>/g, '').trim();
    }
    return decoded.trim();
  }
  return '';
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
    console.log("Saving memory to LIAM...");
    const cryptoKey = await importPrivateKey(privateKey);
    
    const requestBody = { 
      userKey, 
      content: memoryText, 
      tag: 'EMAIL' 
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

    console.log('Memory saved successfully to LIAM');
    return true;
  } catch (error) {
    console.error('Failed to save memory:', error);
    return false;
  }
}

// Parse the Composio wrapped payload format
function parseComposioPayload(raw: ComposioWrappedPayload): {
  emailData: EmailData | null;
  triggerName: string | undefined;
  triggerId: string | undefined;
} {
  const metadata = raw.metadata;
  const data = raw.data;
  
  if (!metadata || !data) {
    console.log("Missing metadata or data in payload");
    return { emailData: null, triggerName: undefined, triggerId: undefined };
  }
  
  // Extract body - for incoming emails it's in message_text, for outgoing it's in parts
  let body = data.message_text || '';
  if (!body && data.payload?.parts) {
    body = extractBodyFromParts(data.payload.parts);
  }
  
  return {
    emailData: {
      from: data.sender,
      to: data.to || data.recipients,
      subject: data.subject,
      body,
      date: data.message_timestamp,
      messageId: data.message_id,
      threadId: data.thread_id,
    },
    triggerName: metadata.trigger_slug,
    triggerId: metadata.trigger_id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isTestMode = url.searchParams.get("test") === "true";

  console.log("=== Email Automation Webhook ===");
  console.log("Timestamp:", new Date().toISOString());

  try {
    const rawPayload = await req.json();
    console.log("Payload type:", rawPayload.type);
    console.log("Raw payload keys:", Object.keys(rawPayload));

    // Parse Composio wrapped format
    const { emailData, triggerName, triggerId } = parseComposioPayload(rawPayload);
    
    console.log("Trigger name:", triggerName);
    console.log("Trigger ID:", triggerId);
    console.log("Has email data:", !!emailData);
    
    if (emailData) {
      console.log("From:", emailData.from);
      console.log("To:", emailData.to);
      console.log("Subject:", emailData.subject);
      console.log("Body preview:", emailData.body?.substring(0, 100));
    }

    if (isTestMode) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Test webhook received",
          testMode: true,
          triggerId,
          triggerName,
          hasEmailData: !!emailData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!emailData || !triggerName || !triggerId) {
      console.log("Missing required data - emailData:", !!emailData, "triggerName:", triggerName, "triggerId:", triggerId);
      return new Response(
        JSON.stringify({ success: true, message: "Missing required data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine direction
    const isIncoming = triggerName === "GMAIL_NEW_GMAIL_MESSAGE";
    const isOutgoing = triggerName === "GMAIL_EMAIL_SENT_TRIGGER";

    if (!isIncoming && !isOutgoing) {
      console.log("Unknown trigger type:", triggerName);
      return new Response(
        JSON.stringify({ success: true, message: "Unknown trigger type" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the contact/user for this trigger
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const triggerColumn = isIncoming ? 'incoming_trigger_id' : 'outgoing_trigger_id';
    
    console.log("Looking up trigger:", triggerId, "in column:", triggerColumn);
    
    const { data: contact, error: contactError } = await adminClient
      .from('email_automation_contacts')
      .select('user_id, email_address')
      .eq(triggerColumn, triggerId)
      .single();

    if (contactError || !contact) {
      console.log("Trigger not found in database. ID:", triggerId);
      // Log all contacts for debugging
      const { data: allContacts } = await adminClient
        .from('email_automation_contacts')
        .select('email_address, incoming_trigger_id, outgoing_trigger_id');
      console.log("Registered triggers:", JSON.stringify(allContacts));
      return new Response(
        JSON.stringify({ success: true, message: "Trigger not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found contact:", contact.email_address);

    // Get user's API keys
    const { data: apiKeys, error: apiKeysError } = await adminClient
      .from('user_api_keys')
      .select('api_key, private_key, user_key')
      .eq('user_id', contact.user_id)
      .single();

    if (apiKeysError || !apiKeys) {
      console.log("No API keys for user:", contact.user_id);
      return new Response(
        JSON.stringify({ success: false, message: "No API keys configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format and save the memory
    const memoryText = formatEmailAsMemory(emailData, isIncoming);
    console.log("Memory to save:", memoryText);

    const saved = await saveMemoryToLiam(
      memoryText,
      apiKeys.api_key,
      apiKeys.private_key,
      apiKeys.user_key
    );

    // Record processed email locally for history display
    try {
      await adminClient.from("email_automation_processed_emails").insert({
        user_id: contact.user_id,
        contact_email: contact.email_address,
        sender: emailData.from || null,
        subject: emailData.subject || null,
        snippet: emailData.body ? emailData.body.substring(0, 200) : null,
        direction: isIncoming ? "incoming" : "outgoing",
        email_message_id: emailData.messageId || null,
      });
    } catch (logErr) {
      console.error("Failed to log processed email:", logErr);
    }

    return new Response(
      JSON.stringify({ 
        success: saved, 
        message: saved ? "Memory saved" : "Failed to save",
        contact: contact.email_address,
        type: isIncoming ? "incoming" : "outgoing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
