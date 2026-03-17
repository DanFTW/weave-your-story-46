import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, boardId, doneListId, monitorNewCards, monitorCompletedCards, newCardTriggerId, updatedCardTriggerId } = await req.json();

    // Get user's Trello connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "trello")
      .eq("status", "connected")
      .single();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Trello not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    // Validate connection ID format (must be ca_* not ac_*)
    if (!connectionId?.startsWith('ca_')) {
      console.error('[Trello] Invalid connection ID format:', connectionId);
      return new Response(JSON.stringify({ 
        error: "Invalid Trello connection",
        details: "Connection ID must be a connected_account_id (ca_*). Please reconnect Trello." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Trello] Action: ${action}, Connection ID: ${connectionId}`);

    // Helper to safely parse JSON responses
    const safeJsonParse = async (response: Response) => {
      const text = await response.text();
      if (!text || text.trim() === "") {
        console.log("Empty response from API, status:", response.status);
        return null;
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON:", text.substring(0, 500));
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    };

    // Handle different actions
    switch (action) {
      case "get-boards": {
        console.log(`[Trello] Fetching boards for connection: ${connectionId}`);
        
        const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER", {
          method: "POST",
          headers: {
            "x-api-key": COMPOSIO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { idMember: "me" },  // "me" = authenticated user
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Trello] Get boards error ${response.status}:`, errorText);
          
          let errorDetails = "Unknown error";
          try {
            const parsed = JSON.parse(errorText);
            // Handle nested error structure: {"error": {"message": "..."}}
            if (parsed.error && typeof parsed.error === 'object') {
              errorDetails = parsed.error.message || parsed.error.suggested_fix || JSON.stringify(parsed.error);
            } else {
              errorDetails = parsed.message || parsed.error || parsed.details || errorText;
            }
          } catch {
            errorDetails = errorText || `HTTP ${response.status}`;
          }
          
          return new Response(JSON.stringify({ 
            error: "Failed to load boards",
            details: errorDetails,
            boards: [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await safeJsonParse(response);
        console.log("[Trello] Get boards response:", JSON.stringify(data));

        const boards = data?.data?.response_data || data?.data?.details || (Array.isArray(data?.data) ? data.data : []);
        
        return new Response(JSON.stringify({ 
          boards: Array.isArray(boards) ? boards.map((b: any) => ({
            id: b.id,
            name: b.name,
            url: b.url,
          })) : []
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-lists": {
        if (!boardId) {
          return new Response(JSON.stringify({ error: "boardId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[Trello] Fetching lists for board: ${boardId}`);
        
        const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD", {
          method: "POST",
          headers: {
            "x-api-key": COMPOSIO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { idBoard: boardId },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Trello] Get lists error ${response.status}:`, errorText);
          
          let errorDetails = "Unknown error";
          try {
            const parsed = JSON.parse(errorText);
            // Handle nested error structure: {"error": {"message": "..."}}
            if (parsed.error && typeof parsed.error === 'object') {
              errorDetails = parsed.error.message || parsed.error.suggested_fix || JSON.stringify(parsed.error);
            } else {
              errorDetails = parsed.message || parsed.error || parsed.details || errorText;
            }
          } catch {
            errorDetails = errorText || `HTTP ${response.status}`;
          }
          
          return new Response(JSON.stringify({ 
            error: "Failed to load lists",
            details: errorDetails,
            lists: [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await safeJsonParse(response);
        console.log("[Trello] Get lists response:", JSON.stringify(data));

        const lists = data?.data?.response_data || data?.data?.details || (Array.isArray(data?.data) ? data.data : []);
        
        return new Response(JSON.stringify({ 
          lists: Array.isArray(lists) ? lists.map((l: any) => ({
            id: l.id,
            name: l.name,
            closed: l.closed || false,
          })) : []
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "activate": {
        if (!boardId) {
          return new Response(JSON.stringify({ error: "boardId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webhookUrl = `${SUPABASE_URL}/functions/v1/trello-automation-webhook`;
        const results: { newCardTriggerId?: string; updatedCardTriggerId?: string } = {};

        // Create TRELLO_NEW_CARD_TRIGGER if monitoring new cards
        if (monitorNewCards) {
          console.log("Creating TRELLO_NEW_CARD_TRIGGER...");
          const newCardResponse = await fetch(
            `${COMPOSIO_API_BASE}/trigger_instances/TRELLO_NEW_CARD_TRIGGER/upsert`,
            {
              method: "POST",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                connected_account_id: connectionId,
                trigger_config: {
                  idBoard: boardId,
                },
                webhook_url: webhookUrl,
              }),
            }
          );

          const newCardData = await safeJsonParse(newCardResponse);
          console.log("New card trigger response:", JSON.stringify(newCardData));
          
          if (newCardData?.trigger_id) {
            results.newCardTriggerId = newCardData.trigger_id;
          }
        }

        // Create TRELLO_UPDATED_CARD_TRIGGER if monitoring completed cards
        if (monitorCompletedCards && doneListId) {
          console.log("Creating TRELLO_UPDATED_CARD_TRIGGER...");
          const updatedCardResponse = await fetch(
            `${COMPOSIO_API_BASE}/trigger_instances/TRELLO_UPDATED_CARD_TRIGGER/upsert`,
            {
              method: "POST",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                connected_account_id: connectionId,
                trigger_config: {
                  idBoard: boardId,
                },
                webhook_url: webhookUrl,
              }),
            }
          );

          const updatedCardData = await safeJsonParse(updatedCardResponse);
          console.log("Updated card trigger response:", JSON.stringify(updatedCardData));
          
          if (updatedCardData?.trigger_id) {
            results.updatedCardTriggerId = updatedCardData.trigger_id;
          }
        }

        // Update config with trigger IDs and set active
        await supabaseClient
          .from("trello_automation_config")
          .update({
            is_active: true,
            new_card_trigger_id: results.newCardTriggerId || null,
            updated_card_trigger_id: results.updatedCardTriggerId || null,
          })
          .eq("user_id", user.id);

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deactivate": {
        // Disable triggers if they exist
        if (newCardTriggerId) {
          try {
            await fetch(`${COMPOSIO_API_BASE}/trigger_instances/manage/${newCardTriggerId}`, {
              method: "PATCH",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ enabled: false }),
            });
          } catch (e) {
            console.error("Failed to disable new card trigger:", e);
          }
        }

        if (updatedCardTriggerId) {
          try {
            await fetch(`${COMPOSIO_API_BASE}/trigger_instances/manage/${updatedCardTriggerId}`, {
              method: "PATCH",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ enabled: false }),
            });
          } catch (e) {
            console.error("Failed to disable updated card trigger:", e);
          }
        }

        // Update config to inactive
        await supabaseClient
          .from("trello_automation_config")
          .update({ is_active: false })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-board-data": {
        if (!boardId) {
          return new Response(JSON.stringify({ error: "boardId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[Trello] Fetching board data (lists+cards) for board: ${boardId}`);

        // Fetch lists and cards in parallel
        const [listsRes, cardsRes] = await Promise.all([
          fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD", {
            method: "POST",
            headers: { "x-api-key": COMPOSIO_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ connected_account_id: connectionId, arguments: { idBoard: boardId } }),
          }),
          fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS_CARDS_BY_ID_BOARD", {
            method: "POST",
            headers: { "x-api-key": COMPOSIO_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ connected_account_id: connectionId, arguments: { idBoard: boardId } }),
          }),
        ]);

        if (!listsRes.ok || !cardsRes.ok) {
          const errText = !listsRes.ok ? await listsRes.text() : await cardsRes.text();
          console.error(`[Trello] get-board-data error:`, errText);
          return new Response(JSON.stringify({ error: "Failed to load board data", details: errText }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const [listsData, cardsData] = await Promise.all([safeJsonParse(listsRes), safeJsonParse(cardsRes)]);

        const rawLists = listsData?.data?.response_data || listsData?.data?.details || (Array.isArray(listsData?.data) ? listsData.data : []);
        const rawCards = cardsData?.data?.response_data || cardsData?.data?.details || (Array.isArray(cardsData?.data) ? cardsData.data : []);

        // Group cards by list
        const cardsByList: Record<string, any[]> = {};
        if (Array.isArray(rawCards)) {
          for (const c of rawCards) {
            const lid = c.idList;
            if (!cardsByList[lid]) cardsByList[lid] = [];
            cardsByList[lid].push({ id: c.id, name: c.name, desc: c.desc, idList: c.idList, idBoard: c.idBoard, due: c.due, dueComplete: c.dueComplete, labels: c.labels, url: c.url });
          }
        }

        const listsWithCards = (Array.isArray(rawLists) ? rawLists : [])
          .filter((l: any) => !l.closed)
          .map((l: any) => ({
            id: l.id,
            name: l.name,
            closed: l.closed || false,
            cards: cardsByList[l.id] || [],
          }));

        return new Response(JSON.stringify({ lists: listsWithCards }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
