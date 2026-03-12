import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[Dropbox] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
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

    // Auth
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
    console.log(`[Dropbox] Action: ${action}, User: ${userId}`);

    // Get Dropbox connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "dropbox")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Dropbox not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    // === SEARCH DOCS ===
    if (action === "search-docs") {
      const { query } = body;
      if (!query || typeof query !== "string") {
        return new Response(JSON.stringify({ error: "Query required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[Dropbox] Searching for: ${query}`);

      const toolResponse = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/DROPBOX_SEARCH_FILE_OR_FOLDER",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { query },
          }),
        }
      );

      const toolText = await toolResponse.text();
      if (!toolResponse.ok) {
        console.error("[Dropbox Search] Composio error:", toolText.slice(0, 500));
        throw new Error(`Search failed: ${toolResponse.status}`);
      }

      const toolData = safeJsonParse(toolText);
      console.log("[Dropbox Search] Response shape:", JSON.stringify({
        hasData: !!toolData?.data,
        keys: toolData?.data ? Object.keys(toolData.data).slice(0, 10) : [],
      }));

      // Extract matches from Dropbox search response
      let matches: any[] = [];
      const rd = toolData?.data?.response_data;
      if (rd) {
        if (Array.isArray(rd.matches)) matches = rd.matches;
        else if (Array.isArray(rd)) matches = rd;
      }
      if (matches.length === 0 && Array.isArray(toolData?.data?.matches)) {
        matches = toolData.data.matches;
      }
      // Also check if response_data itself has items
      if (matches.length === 0 && Array.isArray(toolData?.data)) {
        matches = toolData.data;
      }

      console.log(`[Dropbox Search] Found ${matches.length} matches`);

      // Normalize results — Dropbox search returns { metadata: { metadata: { ... } } } or flat
      const files = matches.slice(0, 20).map((m: any) => {
        const meta = m?.metadata?.metadata || m?.metadata || m;
        const normalizedPath = meta?.path_lower || meta?.path_display || "";

        return {
          // DROPBOX_READ_FILE expects a path argument, so prefer path over id
          id: normalizedPath || meta?.id || meta?.name || "",
          name: meta?.name || "Untitled",
          path: normalizedPath,
          createdTime: meta?.server_modified || meta?.client_modified || "",
        };
      }).filter((f: any) => f.id);

      // Dedup check using dropbox: prefix
      const prefixedIds = files.map((f: any) => `dropbox:${f.id}`);
      const { data: existing } = prefixedIds.length > 0
        ? await supabaseClient.from("googledrive_processed_documents").select("googledrive_file_id").eq("user_id", userId).in("googledrive_file_id", prefixedIds)
        : { data: [] };
      const existingIds = new Set((existing || []).map((e: any) => e.googledrive_file_id));

      const results = files.map((f: any) => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
        webViewLink: "",
        alreadySaved: existingIds.has(`dropbox:${f.id}`),
        source: "dropbox",
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === EXPORT DOC ===
    if (action === "export-doc") {
      const { fileId, fileName } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[Dropbox] Reading file: ${fileId}`);

      // DROPBOX_READ_FILE expects a path argument
      const filePath = (fileId || "").trim();

      if (!filePath) {
        return new Response(JSON.stringify({ error: "Invalid file path" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolResponse = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/DROPBOX_READ_FILE",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { path: filePath },
          }),
        }
      );

      const toolText = await toolResponse.text();
      if (!toolResponse.ok) {
        console.error("[Dropbox Export] Composio error:", toolText.slice(0, 500));
        throw new Error(`Export failed: ${toolResponse.status}`);
      }

      const toolData = safeJsonParse(toolText);
      console.log("[Dropbox Export] Response shape:", JSON.stringify({
        hasData: !!toolData?.data,
        keys: toolData?.data ? Object.keys(toolData.data).slice(0, 10) : [],
        responseDataType: typeof toolData?.data?.response_data,
      }));

      // Extract text content from various possible shapes
      let content = "";
      const d = toolData?.data;
      if (d) {
        // Check response_data first
        const rd = d.response_data;
        if (typeof rd === "string" && rd.trim()) {
          content = rd.trim();
        } else if (rd && typeof rd === "object") {
          if (typeof rd.content === "string" && rd.content.trim()) content = rd.content.trim();
          else if (typeof rd.text === "string" && rd.text.trim()) content = rd.text.trim();
          else if (typeof rd.file_content === "string" && rd.file_content.trim()) content = rd.file_content.trim();
          else if (typeof rd.data === "string" && rd.data.trim()) content = rd.data.trim();
        }

        // Check top-level fields
        if (!content) {
          if (typeof d.content === "string" && d.content.trim()) content = d.content.trim();
          else if (typeof d.file_content === "string" && d.file_content.trim()) content = d.file_content.trim();
          else if (typeof d.text === "string" && d.text.trim()) content = d.text.trim();
        }

        // Check for s3url pattern (presigned download URL)
        if (!content) {
          const s3url = d.downloaded_file_content?.s3url || rd?.downloaded_file_content?.s3url;
          if (s3url && typeof s3url === "string") {
            console.log("[Dropbox] Fetching content from s3url...");
            try {
              const resp = await fetch(s3url);
              if (resp.ok) {
                const text = await resp.text();
                if (text.trim()) content = text.trim();
              }
            } catch (e) {
              console.error("[Dropbox] s3url fetch error:", e);
            }
          }
        }

        // Last resort: stringify response_data
        if (!content && rd && typeof rd === "object") {
          const stringified = JSON.stringify(rd);
          if (stringified.length > 10) content = stringified;
        }
      }

      if (!content) {
        console.error("[Dropbox Export] Could not extract content. Full response:", JSON.stringify(toolData).slice(0, 1000));
        return new Response(JSON.stringify({ error: "Could not extract document content" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[Dropbox Export] Extracted content length: ${content.length}`);

      return new Response(JSON.stringify({
        success: true,
        content,
        title: fileName || "Untitled",
        fileId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SAVE DOC (mark as processed) ===
    if (action === "save-doc") {
      const { fileId } = body;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prefixedId = `dropbox:${fileId}`;

      // Check dedup
      const { data: existingDoc } = await supabaseClient
        .from("googledrive_processed_documents")
        .select("id")
        .eq("user_id", userId)
        .eq("googledrive_file_id", prefixedId)
        .maybeSingle();

      if (existingDoc) {
        return new Response(JSON.stringify({ alreadySaved: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark processed
      await supabaseClient.from("googledrive_processed_documents").insert({
        user_id: userId,
        googledrive_file_id: prefixedId,
      });

      // Increment counter on googledrive_automation_config (reused for both sources)
      const { data: currentConfig } = await supabaseClient
        .from("googledrive_automation_config")
        .select("documents_saved")
        .eq("user_id", userId)
        .maybeSingle();

      if (currentConfig) {
        await supabaseClient
          .from("googledrive_automation_config")
          .update({ documents_saved: (currentConfig.documents_saved || 0) + 1 })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Dropbox] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
