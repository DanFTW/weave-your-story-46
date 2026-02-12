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

async function createMemory(apiKeys: any, content: string, tag?: string): Promise<boolean> {
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
      console.error("[GoogleDrive] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[GoogleDrive] Error creating memory:", error);
    return false;
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

  // Chunk the content
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

// === FETCH DOCUMENT CONTENT ===

async function fetchDocumentContent(connectionId: string, fileId: string): Promise<string | null> {
  const accessToken = await getAccessToken(connectionId);
  if (!accessToken) {
    console.error("[GoogleDrive] No access token available");
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error(`[GoogleDrive] Export failed for ${fileId}: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error(`[GoogleDrive] Error fetching document ${fileId}:`, err);
    return null;
  }
}

// === SYNC GOOGLE DRIVE DOCUMENTS ===

async function syncGoogleDriveDocuments(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newDocuments: number; totalSaved: number }> {
  console.log(`[GoogleDrive Sync] Fetching documents for user ${userId}`);

  // Use Composio tool to list files
  let files: any[] = [];

  try {
    const toolResponse = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLEDRIVE_LIST_FILES",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            q: "mimeType='application/vnd.google-apps.document' and trashed=false",
            page_size: 100,
          },
        }),
      }
    );

    const toolText = await toolResponse.text();
    console.log(`[GoogleDrive Sync] Composio list response status: ${toolResponse.status}`);

    if (toolResponse.ok) {
      const toolData = JSON.parse(toolText);
      // Extract files from nested Composio response
      const responseData = toolData?.data?.response_data || toolData?.data || toolData;
      files = responseData?.files || responseData?.items || [];
      if (Array.isArray(responseData)) files = responseData;
    } else {
      console.warn("[GoogleDrive Sync] Composio list failed:", toolText.slice(0, 500));

      // Fallback: direct Google Drive API
      const accessToken = await getAccessToken(connectionId);
      if (accessToken) {
        const driveResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false")}&fields=files(id,name,createdTime,modifiedTime)&pageSize=100`,
          { headers: { "Authorization": `Bearer ${accessToken}` } }
        );
        if (driveResponse.ok) {
          const driveData = await driveResponse.json();
          files = driveData?.files || [];
        }
      }
    }
  } catch (err) {
    console.error("[GoogleDrive Sync] Error listing files:", err);
  }

  console.log(`[GoogleDrive Sync] Found ${files.length} total documents`);

  if (files.length === 0) {
    await supabaseClient
      .from("googledrive_automation_config")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { newDocuments: 0, totalSaved: 0 };
  }

  // Check which are already processed
  const fileIds = files.map((f: any) => String(f.id));
  const { data: existing } = await supabaseClient
    .from("googledrive_processed_documents")
    .select("googledrive_file_id")
    .eq("user_id", userId)
    .in("googledrive_file_id", fileIds);

  const existingIds = new Set((existing || []).map((e: any) => e.googledrive_file_id));
  const newFiles = files.filter((f: any) => !existingIds.has(String(f.id)));

  console.log(`[GoogleDrive Sync] ${newFiles.length} new documents to process`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let processed = 0;

  for (let i = 0; i < newFiles.length; i++) {
    const file = newFiles[i];
    const fileId = String(file.id);
    const fileName = file.name || "Untitled Document";

    // Fetch full document content
    const content = await fetchDocumentContent(connectionId, fileId);
    if (!content || content.trim().length === 0) {
      console.warn(`[GoogleDrive Sync] Empty or failed content for ${fileId}, skipping`);
      continue;
    }

    if (apiKeys) {
      const memoryChunks = formatDocumentAsMemory(fileName, content);
      let allChunksSaved = true;

      for (const chunk of memoryChunks) {
        const success = await createMemory(apiKeys, chunk, "GOOGLEDRIVE");
        if (!success) {
          allChunksSaved = false;
          console.warn(`[GoogleDrive Sync] Memory chunk failed for ${fileId}`);
          break;
        }
      }

      if (allChunksSaved) {
        await supabaseClient.from("googledrive_processed_documents").insert({
          user_id: userId,
          googledrive_file_id: fileId,
        });
        processed++;
        console.log(`[GoogleDrive Sync] Saved ${memoryChunks.length} chunk(s) for "${fileName}"`);
      }
    }

    // Rate limit
    if (i < newFiles.length - 1 && i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Update stats
  const { data: currentConfig } = await supabaseClient
    .from("googledrive_automation_config")
    .select("documents_saved")
    .eq("user_id", userId)
    .maybeSingle();

  const newTotal = (currentConfig?.documents_saved || 0) + processed;

  await supabaseClient
    .from("googledrive_automation_config")
    .update({
      documents_saved: newTotal,
      last_sync_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { newDocuments: processed, totalSaved: newTotal };
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    console.log(`[GoogleDrive Triggers] Action: ${action}, User: ${userId}`);

    // Get user's Google Drive connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "googledrive")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Google Drive not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    // === ACTIVATE ===
    if (action === "activate") {
      // Create/enable Composio trigger for "File Created"
      let triggerInstanceId: string | null = null;

      try {
        const triggerResponse = await fetch(
          "https://backend.composio.dev/api/v3/triggers/enable",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify({
              connected_account_id: connectionId,
              trigger_slug: "GOOGLEDRIVE_FILE_CREATED",
              config: {},
            }),
          }
        );

        if (triggerResponse.ok) {
          const triggerData = await triggerResponse.json();
          triggerInstanceId = triggerData?.trigger_instance_id || triggerData?.id || null;
          console.log(`[GoogleDrive Triggers] Trigger created: ${triggerInstanceId}`);
        } else {
          const errText = await triggerResponse.text();
          console.warn(`[GoogleDrive Triggers] Trigger creation failed (${triggerResponse.status}): ${errText.slice(0, 300)}`);
          // Non-fatal: continue with manual-poll only mode
        }
      } catch (triggerErr) {
        console.warn("[GoogleDrive Triggers] Trigger creation error:", triggerErr);
      }

      // Update config
      const { data: existing } = await supabaseClient
        .from("googledrive_automation_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        await supabaseClient
          .from("googledrive_automation_config")
          .update({
            is_active: true,
            trigger_instance_id: triggerInstanceId || existing.trigger_instance_id,
          })
          .eq("user_id", userId);
      } else {
        await supabaseClient
          .from("googledrive_automation_config")
          .insert({
            user_id: userId,
            is_active: true,
            trigger_instance_id: triggerInstanceId,
          });
      }

      // Run initial sync
      const syncResult = await syncGoogleDriveDocuments(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({
          success: true,
          triggerInstanceId,
          ...syncResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE ===
    if (action === "deactivate") {
      // Try to disable trigger
      const { data: config } = await supabaseClient
        .from("googledrive_automation_config")
        .select("trigger_instance_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.trigger_instance_id) {
        try {
          await fetch(
            `https://backend.composio.dev/api/v3/triggers/disable/${config.trigger_instance_id}`,
            {
              method: "POST",
              headers: { "x-api-key": COMPOSIO_API_KEY },
            }
          );
        } catch (err) {
          console.warn("[GoogleDrive Triggers] Trigger disable error:", err);
        }
      }

      await supabaseClient
        .from("googledrive_automation_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL POLL ===
    if (action === "manual-poll") {
      console.log(`[GoogleDrive Triggers] Manual poll for user ${userId}`);
      const result = await syncGoogleDriveDocuments(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[GoogleDrive Triggers] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
