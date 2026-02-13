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

    const { action, serverId, channelId, triggerInstanceId } = await req.json();

    // Get user's Discord connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "discord")
      .eq("status", "connected")
      .single();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Discord not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    if (!connectionId?.startsWith("ca_")) {
      console.error("[Discord] Invalid connection ID format:", connectionId);
      return new Response(JSON.stringify({
        error: "Invalid Discord connection",
        details: "Connection ID must be a connected_account_id (ca_*). Please reconnect Discord.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Discord] Action: ${action}, Connection ID: ${connectionId}`);

    const safeJsonParse = async (response: Response) => {
      const text = await response.text();
      if (!text || text.trim() === "") return null;
      try {
        return JSON.parse(text);
      } catch {
        console.error("Failed to parse JSON:", text.substring(0, 500));
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    };

    switch (action) {
      case "get-servers": {
        console.log(`[Discord] Fetching servers for connection: ${connectionId}`);

        const response = await fetch(
          `${COMPOSIO_API_BASE}/tools/execute/DISCORD_LIST_CURRENT_USER_GUILDS`,
          {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connected_account_id: connectionId,
              arguments: {},
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Discord] Get servers error ${response.status}:`, errorText);

          let errorDetails = "Unknown error";
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error && typeof parsed.error === "object") {
              errorDetails = parsed.error.message || parsed.error.suggested_fix || JSON.stringify(parsed.error);
            } else {
              errorDetails = parsed.message || parsed.error || parsed.details || errorText;
            }
          } catch {
            errorDetails = errorText || `HTTP ${response.status}`;
          }

          return new Response(JSON.stringify({
            error: "Failed to load servers",
            details: errorDetails,
            servers: [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await safeJsonParse(response);
        console.log("[Discord] Get servers response:", JSON.stringify(data));

        const guilds = data?.data?.response_data || data?.data || [];

        return new Response(JSON.stringify({
          servers: Array.isArray(guilds)
            ? guilds.map((g: any) => ({
                id: g.id,
                name: g.name,
                icon: g.icon || null,
              }))
            : [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-channels": {
        if (!serverId) {
          return new Response(JSON.stringify({ error: "serverId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[Discord] Fetching channels for server: ${serverId}`);

        const response = await fetch(
          `${COMPOSIO_API_BASE}/tools/execute/DISCORD_LIST_GUILD_CHANNELS`,
          {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connected_account_id: connectionId,
              arguments: { guild_id: serverId },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Discord] Get channels error ${response.status}:`, errorText);

          let errorDetails = "Unknown error";
          try {
            const parsed = JSON.parse(errorText);
            if (parsed.error && typeof parsed.error === "object") {
              errorDetails = parsed.error.message || parsed.error.suggested_fix || JSON.stringify(parsed.error);
            } else {
              errorDetails = parsed.message || parsed.error || parsed.details || errorText;
            }
          } catch {
            errorDetails = errorText || `HTTP ${response.status}`;
          }

          return new Response(JSON.stringify({
            error: "Failed to load channels",
            details: errorDetails,
            channels: [],
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const data = await safeJsonParse(response);
        console.log("[Discord] Get channels response:", JSON.stringify(data));

        const allChannels = data?.data?.response_data || data?.data || [];

        // Filter to text channels only (type 0)
        const textChannels = Array.isArray(allChannels)
          ? allChannels
              .filter((c: any) => c.type === 0)
              .map((c: any) => ({
                id: c.id,
                name: c.name,
                type: c.type,
              }))
          : [];

        return new Response(JSON.stringify({ channels: textChannels }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "activate": {
        if (!channelId) {
          return new Response(JSON.stringify({ error: "channelId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const webhookUrl = `${SUPABASE_URL}/functions/v1/discord-automation-webhook`;

        console.log("[Discord] Creating DISCORD_NEW_MESSAGE_TRIGGER...");
        const triggerResponse = await fetch(
          `${COMPOSIO_API_BASE}/trigger_instances/DISCORD_NEW_MESSAGE_TRIGGER/upsert`,
          {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              connected_account_id: connectionId,
              trigger_config: {
                channel_id: channelId,
              },
              webhook_url: webhookUrl,
            }),
          }
        );

        const triggerData = await safeJsonParse(triggerResponse);
        console.log("[Discord] Trigger response:", JSON.stringify(triggerData));

        const resultTriggerId = triggerData?.trigger_id || null;

        // Update config
        await supabaseClient
          .from("discord_automation_config")
          .update({
            is_active: true,
            trigger_instance_id: resultTriggerId,
            connected_account_id: connectionId,
          })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          triggerInstanceId: resultTriggerId,
          connectedAccountId: connectionId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deactivate": {
        if (triggerInstanceId) {
          try {
            await fetch(
              `${COMPOSIO_API_BASE}/trigger_instances/manage/${triggerInstanceId}`,
              {
                method: "PATCH",
                headers: {
                  "x-api-key": COMPOSIO_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ enabled: false }),
              }
            );
          } catch (e) {
            console.error("[Discord] Failed to disable trigger:", e);
          }
        }

        await supabaseClient
          .from("discord_automation_config")
          .update({ is_active: false })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({ success: true }), {
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
