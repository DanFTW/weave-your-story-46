import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

// === CRYPTO UTILITIES FOR LIAM API ===

function removeLeadingZeros(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return bytes.slice(i);
}

function constructLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function toDER(signature: Uint8Array): string {
  const r = removeLeadingZeros(signature.slice(0, 32));
  const s = removeLeadingZeros(signature.slice(32, 64));
  const rPadded = r[0] >= 0x80 ? new Uint8Array([0, ...r]) : r;
  const sPadded = s[0] >= 0x80 ? new Uint8Array([0, ...s]) : s;
  const rLen = constructLength(rPadded.length);
  const sLen = constructLength(sPadded.length);
  const innerLength = 1 + rLen.length + rPadded.length + 1 + sLen.length + sPadded.length;
  const seqLen = constructLength(innerLength);
  const der = new Uint8Array(1 + seqLen.length + innerLength);
  let offset = 0;
  der[offset++] = 0x30;
  der.set(seqLen, offset); offset += seqLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset); offset += rLen.length;
  der.set(rPadded, offset); offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset); offset += sLen.length;
  der.set(sPadded, offset);
  return btoa(String.fromCharCode(...der));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", binaryDer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
  return toDER(new Uint8Array(signature));
}

async function createMemoryViaLiam(apiKeys: any, content: string, tag: string): Promise<boolean> {
  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body = { userKey: apiKeys.user_key, content, tag };
    const signature = await signRequest(privateKey, body);
    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apiKey": apiKeys.api_key, "signature": signature },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[GoogleDrive Webhook] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[GoogleDrive Webhook] Error creating memory:", error);
    return false;
  }
}

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[GoogleDrive Webhook] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
}

// === EXPORT DOCUMENT CONTENT ===

async function exportDocContent(connectionId: string, fileId: string): Promise<string> {
  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLEDRIVE_EXPORT_FILE",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: { fileId, mimeType: "text/plain" },
        }),
      }
    );

    const text = await response.text();
    if (!response.ok) {
      console.error("[GoogleDrive Webhook] Export failed:", response.status, text.slice(0, 300));
      return "";
    }

    const data = safeJsonParse(text);
    return data?.data?.response_data || data?.data?.content || data?.data || "";
  } catch (error) {
    console.error("[GoogleDrive Webhook] Export error:", error);
    return "";
  }
}

// === FORMAT DOCUMENT AS MEMORY ===

function formatDocAsMemory(fileData: any, content: string): string {
  const title = fileData.name || fileData.title || "Untitled Document";
  const parts = ["📄 Google Drive Document Created", ""];
  parts.push(`Document: ${title}`);
  if (fileData.mimeType) parts.push(`Type: ${fileData.mimeType}`);
  if (fileData.createdTime || fileData.created_time) {
    parts.push(`Created: ${new Date(fileData.createdTime || fileData.created_time).toLocaleDateString()}`);
  }
  if (fileData.webViewLink || fileData.web_view_link) {
    parts.push(`Link: ${fileData.webViewLink || fileData.web_view_link}`);
  }
  parts.push("");
  if (content && typeof content === "string") {
    const preview = content.length > 2000 ? content.slice(0, 2000) + "..." : content;
    parts.push("Content Preview:");
    parts.push(preview);
  }
  return parts.join("\n");
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[GoogleDrive Webhook] Received payload:", JSON.stringify(payload).slice(0, 500));

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract trigger instance ID from webhook payload
    const triggerInstanceId = payload.metadata?.trigger_instance_id 
      || payload.trigger_instance_id 
      || payload.metadata?.trigger_id 
      || payload.trigger_id;

    console.log("[GoogleDrive Webhook] Trigger instance ID:", triggerInstanceId);

    if (!triggerInstanceId) {
      console.log("[GoogleDrive Webhook] No trigger instance ID found in payload");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up user by trigger_instance_id
    const { data: config, error: configError } = await supabaseClient
      .from("googledrive_automation_config")
      .select("*")
      .eq("trigger_instance_id", triggerInstanceId)
      .maybeSingle();

    if (configError || !config) {
      console.log("[GoogleDrive Webhook] No config found for trigger:", triggerInstanceId);
      return new Response(JSON.stringify({ received: true, noConfig: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.is_active) {
      console.log("[GoogleDrive Webhook] Automation is inactive for user:", config.user_id);
      return new Response(JSON.stringify({ received: true, inactive: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract file info from payload
    const fileData = payload.data || payload;
    const fileId = fileData.id || fileData.fileId || fileData.file_id;

    if (!fileId) {
      console.log("[GoogleDrive Webhook] No file ID found in payload");
      return new Response(JSON.stringify({ received: true, noFileId: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check dedup
    const { data: existing } = await supabaseClient
      .from("googledrive_processed_documents")
      .select("id")
      .eq("user_id", config.user_id)
      .eq("googledrive_file_id", String(fileId))
      .maybeSingle();

    if (existing) {
      console.log("[GoogleDrive Webhook] Document already processed:", fileId);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's connected_account_id for Composio tool calls
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", config.user_id)
      .eq("integration_id", "googledrive")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      console.error("[GoogleDrive Webhook] No Google Drive connection for user:", config.user_id);
      return new Response(JSON.stringify({ received: true, noConnection: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Export document content
    const content = await exportDocContent(integration.composio_connection_id, String(fileId));

    // Get user API keys for LIAM
    const { data: apiKeys } = await supabaseClient
      .from("user_api_keys")
      .select("*")
      .eq("user_id", config.user_id)
      .maybeSingle();

    if (!apiKeys) {
      console.error("[GoogleDrive Webhook] No API keys for user:", config.user_id);
      return new Response(JSON.stringify({ received: true, noApiKeys: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create memory - retry-safe: only mark processed after success
    const memoryContent = formatDocAsMemory(fileData, content);
    const success = await createMemoryViaLiam(apiKeys, memoryContent, "GOOGLEDRIVE");

    if (success) {
      // Mark as processed
      await supabaseClient.from("googledrive_processed_documents").insert({
        user_id: config.user_id,
        googledrive_file_id: String(fileId),
      });

      // Update stats
      await supabaseClient
        .from("googledrive_automation_config")
        .update({
          documents_saved: (config.documents_saved || 0) + 1,
          last_webhook_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log("[GoogleDrive Webhook] Memory created for document:", fileId);
    } else {
      console.error("[GoogleDrive Webhook] Failed to create memory for document:", fileId);
    }

    return new Response(JSON.stringify({ received: true, processed: success }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GoogleDrive Webhook] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
