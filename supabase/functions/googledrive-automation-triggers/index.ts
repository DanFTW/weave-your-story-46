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

async function createMemory(apiKeys: any, content: string, tag: string): Promise<boolean> {
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
      console.error("[GoogleDrive] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[GoogleDrive] Error creating memory:", error);
    return false;
  }
}

// === SAFE JSON PARSE ===

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[GoogleDrive] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
}

// === EXTRACT TEXT CONTENT FROM COMPOSIO RESPONSE ===

function extractTextContent(data: any): string {
  if (!data?.data) return "";

  const rd = data.data.response_data;
  // Direct string
  if (typeof rd === "string" && rd.trim()) return rd.trim();
  // Nested .content
  if (rd && typeof rd === "object") {
    if (typeof rd.content === "string" && rd.content.trim()) return rd.content.trim();
    if (typeof rd.text === "string" && rd.text.trim()) return rd.text.trim();
    // Base64 bytes field
    if (typeof rd.data === "string" && rd.data.length > 0) {
      try { return new TextDecoder().decode(Uint8Array.from(atob(rd.data), c => c.charCodeAt(0))); } catch { /* not base64 */ }
    }
  }
  // Fallback: data.content
  if (typeof data.data.content === "string" && data.data.content.trim()) return data.data.content.trim();
  // Last resort: stringify if object
  if (rd && typeof rd === "object") return JSON.stringify(rd);
  if (typeof data.data === "string" && data.data.trim()) return data.data.trim();
  return "";
}

// === FORMAT DOCUMENT AS MEMORY ===

function formatDocAsMemory(doc: any, content: string): string {
  const title = doc.name || doc.title || "Untitled Document";
  const created = doc.createdTime || doc.created_time;
  const link = doc.webViewLink || doc.web_view_link;

  let header = `Google Drive Document: ${title}`;
  const meta: string[] = [];
  if (created) meta.push(`Created: ${new Date(created).toLocaleDateString()}`);
  if (link) meta.push(`Link: ${link}`);
  if (meta.length) header += `\n${meta.join(" | ")}`;

  const MAX_CONTENT = 8000;
  const trimmedContent = content && typeof content === "string"
    ? (content.length > MAX_CONTENT ? content.slice(0, MAX_CONTENT) + "..." : content)
    : "";

  return trimmedContent ? `${header}\n\n${trimmedContent}` : header;
}

// === EXPORT DOCUMENT CONTENT ===

async function exportDocContent(connectionId: string, fileId: string): Promise<string> {
  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLEDRIVE_DOWNLOAD_FILE",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: { file_id: fileId, mime_type: "text/plain" },
        }),
      }
    );

    const text = await response.text();
    if (!response.ok) {
      console.error("[GoogleDrive] Export failed:", response.status, text.slice(0, 300));
      return "";
    }

    const data = safeJsonParse(text);
    console.log("[GoogleDrive] Export response shape:", JSON.stringify({
      hasData: !!data?.data,
      responseDataType: typeof data?.data?.response_data,
      contentType: typeof data?.data?.content,
      keys: data?.data ? Object.keys(data.data).slice(0, 10) : [],
    }));

    return extractTextContent(data);
  } catch (error) {
    console.error("[GoogleDrive] Export error:", error);
    return "";
  }
}

// === POLL GOOGLE DRIVE VIA COMPOSIO TOOL ===

async function pollGoogleDriveDocs(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newDocs: number; totalTracked: number }> {
  console.log(`[GoogleDrive Poll] Searching docs for user ${userId}`);

  const toolResponse = await fetch(
    "https://backend.composio.dev/api/v3/tools/execute/GOOGLEDRIVE_FIND_FILE",
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
        },
      }),
    }
  );

  const toolText = await toolResponse.text();
  console.log(`[GoogleDrive Poll] Composio response status: ${toolResponse.status}`);

  if (!toolResponse.ok) {
    console.error("[GoogleDrive Poll] Composio tool error:", toolText.slice(0, 500));
    throw new Error(`Composio tool execution failed: ${toolResponse.status}`);
  }

  const toolData = safeJsonParse(toolText);
  if (!toolData) throw new Error("Failed to parse Composio tool response");

  // Extract files from response
  let files: any[] = [];
  if (Array.isArray(toolData.data?.response_data?.files)) {
    files = toolData.data.response_data.files;
  } else if (Array.isArray(toolData.data?.response_data)) {
    files = toolData.data.response_data;
  } else if (Array.isArray(toolData.data?.files)) {
    files = toolData.data.files;
  } else if (Array.isArray(toolData.data)) {
    files = toolData.data;
  }

  console.log(`[GoogleDrive Poll] Found ${files.length} total docs`);

  if (files.length === 0) {
    await supabaseClient
      .from("googledrive_automation_config")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { newDocs: 0, totalTracked: 0 };
  }

  // Check dedup
  const fileIds = files.map((f: any) => String(f.id));
  const { data: existing } = await supabaseClient
    .from("googledrive_processed_documents")
    .select("googledrive_file_id")
    .eq("user_id", userId)
    .in("googledrive_file_id", fileIds);

  const existingIds = new Set((existing || []).map((e: any) => e.googledrive_file_id));
  const allNewFiles = files.filter((f: any) => !existingIds.has(String(f.id)));
  const BATCH_LIMIT = 10;
  const newFiles = allNewFiles.slice(0, BATCH_LIMIT);

  console.log(`[GoogleDrive Poll] ${allNewFiles.length} new docs found, processing batch of ${newFiles.length}`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let processed = 0;
  for (let i = 0; i < newFiles.length; i++) {
    const doc = newFiles[i];
    const fileId = String(doc.id);

    // Export document content
    const content = await exportDocContent(connectionId, fileId);

    // Create memory (retry-safe: only mark processed after success)
    if (apiKeys) {
      const memoryContent = formatDocAsMemory(doc, content);
      const success = await createMemory(apiKeys, memoryContent, "GOOGLEDRIVE");
      if (success) {
        // Mark as processed only after successful save
        await supabaseClient.from("googledrive_processed_documents").insert({
          user_id: userId,
          googledrive_file_id: fileId,
        });
        processed++;
        console.log(`[GoogleDrive Poll] Memory created for doc ${fileId}`);
      } else {
        console.error(`[GoogleDrive Poll] Memory failed for doc ${fileId}`);
      }
    }

    // Rate limit
    if (i < newFiles.length - 1 && i % 5 === 4) {
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

  return { newDocs: processed, totalTracked: newTotal };
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

    // Auth required for all actions
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
      console.log(`[GoogleDrive Triggers] Activating webhook trigger for user ${userId}`);

      const webhookUrl = `${SUPABASE_URL}/functions/v1/googledrive-automation-webhook`;

      // Upsert the Composio webhook trigger
      const triggerResponse = await fetch(
        "https://backend.composio.dev/api/v3/trigger_instances/GOOGLEDRIVE_NEW_FILE_MATCHING_QUERY_TRIGGER/upsert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            trigger_config: {
              query: "mimeType='application/vnd.google-apps.document' and trashed=false",
            },
            webhook_url: webhookUrl,
          }),
        }
      );

      const triggerText = await triggerResponse.text();
      console.log(`[GoogleDrive Triggers] Trigger upsert status: ${triggerResponse.status}`);

      if (!triggerResponse.ok) {
        console.error("[GoogleDrive Triggers] Trigger upsert failed:", triggerText.slice(0, 500));
        throw new Error(`Failed to create webhook trigger: ${triggerResponse.status}`);
      }

      const triggerData = safeJsonParse(triggerText);
      const triggerInstanceId = triggerData?.id || triggerData?.trigger_instance_id || triggerData?.triggerId || null;

      console.log(`[GoogleDrive Triggers] Trigger instance ID: ${triggerInstanceId}`);

      // Update config with trigger info - no initial poll per plan
      await supabaseClient
        .from("googledrive_automation_config")
        .update({
          is_active: true,
          trigger_instance_id: triggerInstanceId,
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, triggerInstanceId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE ===
    if (action === "deactivate") {
      console.log(`[GoogleDrive Triggers] Deactivating for user ${userId}`);

      // Get trigger instance ID to disable
      const { data: config } = await supabaseClient
        .from("googledrive_automation_config")
        .select("trigger_instance_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.trigger_instance_id) {
        // Disable the trigger via Composio
        try {
          const disableResponse = await fetch(
            `https://backend.composio.dev/api/v3/trigger_instances/manage/${config.trigger_instance_id}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": COMPOSIO_API_KEY,
              },
              body: JSON.stringify({ is_active: false }),
            }
          );
          const disableText = await disableResponse.text();
          console.log(`[GoogleDrive Triggers] Disable trigger status: ${disableResponse.status}`);
        } catch (e) {
          console.error("[GoogleDrive Triggers] Error disabling trigger:", e);
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
      const result = await pollGoogleDriveDocs(supabaseClient, userId, connectionId);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SEARCH DOCS ===
    if (action === "search-docs") {
      const { query } = body;
      if (!query || typeof query !== "string") {
        return new Response(JSON.stringify({ error: "Query required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const escapedQuery = query.replace(/'/g, "\\'");
      console.log(`[GoogleDrive Triggers] Searching docs for query: ${escapedQuery}`);

      const toolResponse = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/GOOGLEDRIVE_FIND_FILE",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: {
              q: `mimeType='application/vnd.google-apps.document' and trashed=false and name contains '${escapedQuery}'`,
            },
          }),
        }
      );

      const toolText = await toolResponse.text();
      if (!toolResponse.ok) {
        console.error("[GoogleDrive Search] Composio error:", toolText.slice(0, 500));
        throw new Error(`Search failed: ${toolResponse.status}`);
      }

      const toolData = safeJsonParse(toolText);
      let files: any[] = [];
      if (Array.isArray(toolData?.data?.response_data?.files)) files = toolData.data.response_data.files;
      else if (Array.isArray(toolData?.data?.response_data)) files = toolData.data.response_data;
      else if (Array.isArray(toolData?.data?.files)) files = toolData.data.files;
      else if (Array.isArray(toolData?.data)) files = toolData.data;

      files = files.slice(0, 20);

      // Cross-reference dedup table
      const fileIds = files.map((f: any) => String(f.id));
      const { data: existing } = fileIds.length > 0
        ? await supabaseClient.from("googledrive_processed_documents").select("googledrive_file_id").eq("user_id", userId).in("googledrive_file_id", fileIds)
        : { data: [] };
      const existingIds = new Set((existing || []).map((e: any) => e.googledrive_file_id));

      const results = files.map((f: any) => ({
        id: String(f.id),
        name: f.name || f.title || "Untitled",
        createdTime: f.createdTime || f.created_time || "",
        webViewLink: f.webViewLink || f.web_view_link || "",
        alreadySaved: existingIds.has(String(f.id)),
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SAVE DOC ===
    if (action === "save-doc") {
      const { fileId, fileName } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check dedup
      const { data: existingDoc } = await supabaseClient
        .from("googledrive_processed_documents")
        .select("id")
        .eq("user_id", userId)
        .eq("googledrive_file_id", fileId)
        .maybeSingle();

      if (existingDoc) {
        return new Response(JSON.stringify({ alreadySaved: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Export content
      const content = await exportDocContent(connectionId, fileId);

      // Get API keys
      const { data: apiKeys } = await supabaseClient
        .from("user_api_keys")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!apiKeys) {
        return new Response(JSON.stringify({ error: "API keys not configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const doc = { name: fileName || "Untitled", createdTime: new Date().toISOString(), webViewLink: "" };
      const memoryContent = formatDocAsMemory(doc, content);
      const success = await createMemory(apiKeys, memoryContent, "GOOGLEDRIVE");

      if (!success) {
        return new Response(JSON.stringify({ error: "Failed to create memory" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark processed + increment counter
      await supabaseClient.from("googledrive_processed_documents").insert({
        user_id: userId, googledrive_file_id: fileId,
      });

      const { data: currentConfig } = await supabaseClient
        .from("googledrive_automation_config")
        .select("documents_saved")
        .eq("user_id", userId)
        .maybeSingle();

      await supabaseClient
        .from("googledrive_automation_config")
        .update({ documents_saved: (currentConfig?.documents_saved || 0) + 1 })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
