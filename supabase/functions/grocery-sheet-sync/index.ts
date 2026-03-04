import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// ── Helpers ──

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function getConnectionId(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "googlesheets")
    .eq("status", "connected")
    .maybeSingle();
  return data?.composio_connection_id ?? null;
}

// ── AI Grocery Parsing ──

interface ParsedGrocery {
  isGrocery: boolean;
  items: { name: string; quantity: string; notes: string }[];
}

async function parseMemoryForGrocery(content: string): Promise<ParsedGrocery> {
  if (!LOVABLE_API_KEY) {
    console.error("[GrocerySync] LOVABLE_API_KEY not configured");
    return { isGrocery: false, items: [] };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You extract grocery/food shopping items from text. Only detect actual grocery items, ingredients, or food products that someone would buy at a store. Do not include restaurant names, recipes, or general food preferences.",
          },
          {
            role: "user",
            content: `Extract grocery items from this text. If no grocery items are mentioned, set isGrocery to false.\n\nText: "${content}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_grocery",
              description: "Extract grocery items from text",
              parameters: {
                type: "object",
                properties: {
                  isGrocery: {
                    type: "boolean",
                    description: "Whether the text mentions grocery/shopping items",
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Item name" },
                        quantity: { type: "string", description: "Quantity or amount, empty if unknown" },
                        notes: { type: "string", description: "Additional notes (brand, variety, etc)" },
                      },
                      required: ["name", "quantity", "notes"],
                    },
                    description: "List of grocery items found",
                  },
                },
                required: ["isGrocery", "items"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_grocery" } },
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[GrocerySync] AI error:", res.status);
      return { isGrocery: false, items: [] };
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return { isGrocery: false, items: [] };
  } catch (e) {
    console.error("[GrocerySync] Parse error:", e);
    return { isGrocery: false, items: [] };
  }
}

// ── Append rows to Google Sheet via Composio ──

async function appendToSheet(
  connectionId: string,
  spreadsheetId: string,
  items: { name: string; quantity: string; notes: string }[],
): Promise<boolean> {
  try {
    const values = items.map((item) => [item.name, item.quantity, item.notes, new Date().toISOString()]);

    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_BATCH_UPDATE",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            spreadsheet_id: spreadsheetId,
            range: "Sheet1!A:D",
            values,
            value_input_option: "USER_ENTERED",
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[GrocerySync] Composio BATCH_UPDATE error ${res.status}:`, errText);
      return false;
    }

    console.log(`[GrocerySync] Appended ${items.length} items to sheet`);
    return true;
  } catch (e) {
    console.error("[GrocerySync] Append error:", e);
    return false;
  }
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const userId = getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = adminClient();

    // ── ACTIVATE ──
    if (action === "activate") {
      await sb
        .from("grocery_sheet_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb
        .from("grocery_sheet_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE-CONFIG ──
    if (action === "update-config") {
      const { spreadsheetId, spreadsheetName } = params;
      await sb
        .from("grocery_sheet_config")
        .update({ spreadsheet_id: spreadsheetId, spreadsheet_name: spreadsheetName })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST-SPREADSHEETS ──
    if (action === "list-spreadsheets") {
      const connectionId = await getConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_SEARCH_SPREADSHEETS",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: {},
          }),
        },
      );

      const raw = await res.text();
      if (!res.ok) {
        console.error(`[GrocerySync] List spreadsheets error ${res.status}:`, raw);
        return new Response(JSON.stringify({ spreadsheets: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const data = JSON.parse(raw);
        const responseData = data?.response_data ?? data?.data ?? data;
        const files = responseData?.files ?? responseData?.items ?? responseData ?? [];
        const spreadsheets = (Array.isArray(files) ? files : []).map((f: any) => ({
          id: f.id ?? f.spreadsheetId,
          name: f.name ?? f.properties?.title ?? "Untitled",
        })).filter((s: any) => s.id);

        return new Response(JSON.stringify({ spreadsheets }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        console.error("[GrocerySync] Failed to parse spreadsheets response");
        return new Response(JSON.stringify({ spreadsheets: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── CREATE-SPREADSHEET ──
    if (action === "create-spreadsheet") {
      const connectionId = await getConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_CREATE_GOOGLE_SHEET1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { title: "Weave — Grocery Items" },
          }),
        },
      );

      const raw = await res.text();
      if (!res.ok) {
        console.error(`[GrocerySync] Create spreadsheet error ${res.status}:`, raw);
        return new Response(JSON.stringify({ error: "Failed to create spreadsheet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const data = JSON.parse(raw);
        console.log("[GrocerySync] Raw create response:", JSON.stringify(data).slice(0, 2000));
        const responseData = data?.response_data ?? data?.data ?? data;
        const spreadsheetId =
          responseData?.spreadsheetId ??
          responseData?.id ??
          responseData?.result?.spreadsheetId ??
          responseData?.spreadsheet_id ??
          responseData?.result?.id ??
          data?.spreadsheetId ??
          data?.id;
        const spreadsheetName =
          responseData?.properties?.title ??
          responseData?.result?.properties?.title ??
          responseData?.title ??
          "Weave — Grocery Items";

        if (!spreadsheetId) {
          console.error("[GrocerySync] No spreadsheetId found in create response");
          return new Response(JSON.stringify({ error: "Spreadsheet created but ID not returned" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Add headers row
        if (spreadsheetId) {
          await appendToSheet(connectionId, spreadsheetId, [
            { name: "Item", quantity: "Quantity", notes: "Notes" },
          ]);
          // Remove the header from items_posted count — it's not a real item
        }

        return new Response(JSON.stringify({ spreadsheetId, spreadsheetName }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse create response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── PROCESS-NEW-MEMORY ──
    if (action === "process-new-memory") {
      const { content, memoryId } = params;
      if (!content || !memoryId) {
        return new Response(JSON.stringify({ error: "Missing content or memoryId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if sync is active and has a sheet configured
      const { data: cfg } = await sb
        .from("grocery_sheet_config")
        .select("is_active, spreadsheet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cfg?.is_active || !cfg?.spreadsheet_id) {
        return new Response(JSON.stringify({ skipped: true, reason: "sync_inactive_or_no_sheet" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already processed
      const { data: existing } = await sb
        .from("grocery_sheet_processed_memories")
        .select("id")
        .eq("user_id", userId)
        .eq("memory_id", memoryId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ skipped: true, reason: "already_processed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse
      const parsed = await parseMemoryForGrocery(content);
      if (!parsed.isGrocery || parsed.items.length === 0) {
        // Mark as processed even if not grocery to avoid re-parsing
        await sb.from("grocery_sheet_processed_memories").insert({ user_id: userId, memory_id: memoryId });
        return new Response(JSON.stringify({ skipped: true, reason: "not_grocery" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const connectionId = await getConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const success = await appendToSheet(connectionId, cfg.spreadsheet_id, parsed.items);

      // Mark as processed
      await sb.from("grocery_sheet_processed_memories").insert({ user_id: userId, memory_id: memoryId });

      if (success) {
        // Increment counter
        const { data: currentCfg } = await sb
          .from("grocery_sheet_config")
          .select("items_posted")
          .eq("user_id", userId)
          .single();

        await sb
          .from("grocery_sheet_config")
          .update({ items_posted: ((currentCfg as any)?.items_posted ?? 0) + parsed.items.length })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ posted: success, itemCount: parsed.items.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANUAL-SYNC ──
    if (action === "manual-sync") {
      const { data: cfg } = await sb
        .from("grocery_sheet_config")
        .select("spreadsheet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cfg?.spreadsheet_id) {
        return new Response(JSON.stringify({ error: "No spreadsheet configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const connectionId = await getConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch user's LIAM API keys
      const { data: apiKeys } = await sb
        .from("user_api_keys")
        .select("api_key, private_key, user_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (!apiKeys) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Sign request for LIAM API
      const pemContents = apiKeys.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "");
      const binaryString = atob(pemContents);
      const keyBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        keyBytes[i] = binaryString.charCodeAt(i);
      }
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBytes.buffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
      );

      const listBody = { userKey: apiKeys.user_key };
      const bodyStr = JSON.stringify(listBody);
      const rawSig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        new TextEncoder().encode(bodyStr),
      );

      // Convert to DER
      const sigBytes = new Uint8Array(rawSig);
      let r = Array.from(sigBytes.slice(0, 32));
      let s = Array.from(sigBytes.slice(32));
      if (r[0] & 0x80) r = [0, ...r];
      if (s[0] & 0x80) s = [0, ...s];
      while (r.length > 1 && r[0] === 0 && !(r[1] & 0x80)) r = r.slice(1);
      while (s.length > 1 && s[0] === 0 && !(s[1] & 0x80)) s = s.slice(1);
      let derInner = [0x02, r.length, ...r, 0x02, s.length, ...s];
      let der = [0x30, derInner.length, ...derInner];
      const signature = btoa(String.fromCharCode(...der));

      // Fetch memories from LIAM
      const listRes = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apiKey: apiKeys.api_key,
          signature,
        },
        body: bodyStr,
      });

      if (!listRes.ok) {
        console.error("[GrocerySync] LIAM list error:", listRes.status);
        return new Response(JSON.stringify({ error: "Failed to fetch memories" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const listJson = await listRes.json();

      let rawMemories: any[] = [];
      if (Array.isArray(listJson)) {
        rawMemories = listJson;
      } else if (Array.isArray(listJson?.data)) {
        rawMemories = listJson.data;
      } else if (Array.isArray(listJson?.data?.memories)) {
        rawMemories = listJson.data.memories;
      } else if (listJson?.data && typeof listJson.data === "object") {
        for (const key of Object.keys(listJson.data)) {
          if (Array.isArray(listJson.data[key])) {
            rawMemories = listJson.data[key];
            break;
          }
        }
      }

      const memories: { id: string; content: string }[] = rawMemories
        .slice(0, 50)
        .map((m: any) => ({
          id: m.transactionNumber || m.id || String(Math.random()),
          content: m.memory || m.content || "",
        }))
        .filter((m: any) => m.content);

      // Get already-processed memory IDs
      const { data: existing } = await sb
        .from("grocery_sheet_processed_memories")
        .select("memory_id")
        .eq("user_id", userId);
      const processedIds = new Set((existing || []).map((e: any) => e.memory_id));

      const unprocessed = memories.filter((m) => !processedIds.has(m.id));
      console.log(`[GrocerySync] Processing ${unprocessed.length} unprocessed memories`);

      let totalPosted = 0;
      let processed = 0;

      for (const mem of unprocessed) {
        try {
          const parsed = await parseMemoryForGrocery(mem.content);
          processed++;

          // Mark as processed
          await sb.from("grocery_sheet_processed_memories").insert({ user_id: userId, memory_id: mem.id });

          if (!parsed.isGrocery || parsed.items.length === 0) continue;

          const success = await appendToSheet(connectionId, cfg.spreadsheet_id, parsed.items);
          if (success) totalPosted += parsed.items.length;
        } catch (err) {
          console.error(`[GrocerySync] Error processing memory ${mem.id}:`, err);
          processed++;
        }
      }

      // Update counter
      if (totalPosted > 0) {
        const { data: currentCfg } = await sb
          .from("grocery_sheet_config")
          .select("items_posted")
          .eq("user_id", userId)
          .single();
        await sb
          .from("grocery_sheet_config")
          .update({ items_posted: ((currentCfg as any)?.items_posted ?? 0) + totalPosted })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed, posted: totalPosted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[GrocerySync] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
