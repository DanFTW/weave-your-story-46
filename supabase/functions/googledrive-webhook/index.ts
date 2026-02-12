import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// === GET ACCESS TOKEN FROM COMPOSIO ===

async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connResponse = await fetch(
      `https://backend.composio.dev/api/v1/connected_accounts/${connectionId}`,
      { headers: { "x-api-key": COMPOSIO_API_KEY } }
    );
    if (!connResponse.ok) return null;
    const connData = await connResponse.json();
    return connData?.connectionParams?.access_token ||
      connData?.connectionParams?.headers?.Authorization?.replace("Bearer ", "") ||
      null;
  } catch {
    return null;
  }
}

// === DOCUMENT CONTENT FORMATTING ===

const MAX_MEMORY_CHUNK_SIZE = 8000;

function formatDocumentAsMemory(title: string, content: string): string[] {
  const header = `Google Drive Document\n\nTitle: ${title}\n\n--- Content ---\n\n`;
  const fullContent = header + content;

  if (fullContent.length <= MAX_MEMORY_CHUNK_SIZE) {
    return [fullContent];
  }

  const chunks: string[] = [];
  const availablePerChunk = MAX_MEMORY_CHUNK_SIZE - header.length - 50;
  const lines = content.split("\n");
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (const line of lines) {
    if (currentLen + line.length + 1 > availablePerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
      currentLen = 0;
    }
    currentChunk.push(line);
    currentLen += line.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join("\n"));

  const totalParts = chunks.length;
  return chunks.map((chunk, i) => {
    const partLabel = `(Part ${i + 1}/${totalParts})`;
    const partHeader = `Google Drive Document ${partLabel}\n\nTitle: ${title}\n\n--- Content ---\n\n`;
    return partHeader + chunk;
  });
}

// === SAVE MEMORY TO LIAM ===

async function saveMemoryToLiam(supabase: any, userId: string, content: string, tag?: string): Promise<boolean> {
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.error("[GoogleDrive Webhook] No API keys for user", userId);
    return false;
  }

  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body: any = { userKey: apiKeys.user_key, content };
    if (tag) body.tag = tag;
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

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rawBody = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[GoogleDrive Webhook] Invalid JSON body");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    console.log("[GoogleDrive Webhook] Received event:", JSON.stringify(payload).slice(0, 500));

    // Extract file info from Composio trigger payload
    const fileData = payload?.data || payload?.payload || payload;
    const fileId = fileData?.fileId || fileData?.file_id || fileData?.id || fileData?.resourceId;
    const fileName = fileData?.name || fileData?.fileName || fileData?.title || "Untitled Document";
    const mimeType = fileData?.mimeType || fileData?.mime_type || "";

    if (!fileId) {
      console.error("[GoogleDrive Webhook] No fileId in payload");
      return new Response(JSON.stringify({ error: "Missing fileId" }), { status: 400 });
    }

    // Validate it's a Google Docs document
    if (mimeType && mimeType !== "application/vnd.google-apps.document") {
      console.log(`[GoogleDrive Webhook] Skipping non-document file: ${mimeType}`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Not a Google Doc" }), { status: 200 });
    }

    // Find the user associated with this trigger
    // Look up all active configs and match by checking processed documents
    const { data: activeConfigs } = await supabase
      .from("googledrive_automation_config")
      .select("*")
      .eq("is_active", true);

    if (!activeConfigs || activeConfigs.length === 0) {
      console.log("[GoogleDrive Webhook] No active configs");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    let processed = false;

    for (const config of activeConfigs) {
      const userId = config.user_id;

      // Check if already processed
      const { data: existing } = await supabase
        .from("googledrive_processed_documents")
        .select("id")
        .eq("user_id", userId)
        .eq("googledrive_file_id", String(fileId))
        .maybeSingle();

      if (existing) {
        console.log(`[GoogleDrive Webhook] Already processed ${fileId} for user ${userId}`);
        continue;
      }

      // Get user's Google Drive connection
      const { data: integration } = await supabase
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId)
        .eq("integration_id", "googledrive")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration?.composio_connection_id) continue;

      // Fetch document content
      const accessToken = await getAccessToken(integration.composio_connection_id);
      if (!accessToken) continue;

      let content: string | null = null;
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
          { headers: { "Authorization": `Bearer ${accessToken}` } }
        );
        if (response.ok) {
          content = await response.text();
        }
      } catch (err) {
        console.error(`[GoogleDrive Webhook] Error fetching content for ${fileId}:`, err);
      }

      if (!content || content.trim().length === 0) continue;

      // Format and save as memory
      const memoryChunks = formatDocumentAsMemory(fileName, content);
      let allSaved = true;

      for (const chunk of memoryChunks) {
        const saved = await saveMemoryToLiam(supabase, userId, chunk, "GOOGLEDRIVE");
        if (!saved) { allSaved = false; break; }
      }

      if (allSaved) {
        // Mark as processed
        await supabase.from("googledrive_processed_documents").insert({
          user_id: userId,
          googledrive_file_id: String(fileId),
        });

        // Update stats
        await supabase
          .from("googledrive_automation_config")
          .update({
            documents_saved: (config.documents_saved || 0) + 1,
            last_webhook_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        processed = true;
        console.log(`[GoogleDrive Webhook] Saved "${fileName}" for user ${userId}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), { status: 200 });
  } catch (err) {
    console.error("[GoogleDrive Webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500 }
    );
  }
});
