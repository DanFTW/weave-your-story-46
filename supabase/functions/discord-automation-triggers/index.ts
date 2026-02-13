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

/**
 * Fetch the Discord access token and its type from Composio connected-account metadata.
 * Returns { token, authHeader } where authHeader is the full Authorization header value
 * (e.g. "Bot xxx" for bot tokens, "Bearer xxx" for OAuth user tokens).
 */
async function getDiscordCredentials(connectionId: string): Promise<{ token: string; authHeader: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(
      `${COMPOSIO_API_BASE}/connected_accounts/${connectionId}`,
      {
        headers: { "x-api-key": COMPOSIO_API_KEY },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const text = await res.text();
    console.log(`[Discord] Composio metadata status: ${res.status}, body: ${text.substring(0, 500)}`);

    if (!res.ok) {
      throw new Error(`Composio metadata HTTP ${res.status}`);
    }

    const meta = JSON.parse(text);
    const token = meta?.connectionParams?.access_token || meta?.data?.access_token;

    if (!token) {
      throw new Error("No access_token in Composio metadata. Please reconnect Discord.");
    }

    // Detect bot vs user OAuth token:
    // Bot tokens from Discord are base64-encoded and start with the bot's user ID
    // The metadata also exposes toolkit.slug ("discordbot" vs "discord") and token_type
    const tokenType = meta?.connectionParams?.token_type || meta?.data?.token_type || "Bearer";
    const toolkitSlug = meta?.toolkit?.slug || meta?.auth_config?.toolkit_slug || "";
    const isBot = toolkitSlug === "discordbot" || tokenType === "Bot";

    const authHeader = isBot ? `Bot ${token}` : `Bearer ${token}`;
    console.log(`[Discord] Token type resolved: ${isBot ? "Bot" : "Bearer"} (toolkit: ${toolkitSlug}, tokenType: ${tokenType})`);

    return { token, authHeader };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

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
        console.log(`[Discord] Fetching servers via direct Discord API for connection: ${connectionId}`);

        let creds: { token: string; authHeader: string };
        try {
          creds = await getDiscordCredentials(connectionId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("[Discord] Token retrieval failed:", msg);
          return new Response(JSON.stringify({
            error: "Discord not connected or token unavailable",
            details: msg,
            servers: [],
          }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        try {
          const discordRes = await fetch(
            "https://discord.com/api/v10/users/@me/guilds",
            {
              headers: { Authorization: creds.authHeader },
              signal: controller.signal,
            }
          );
          clearTimeout(timeout);

          const body = await discordRes.text();
          console.log(`[Discord] Guilds API status: ${discordRes.status}, body: ${body.substring(0, 500)}`);

          if (discordRes.status === 429) {
            const retryAfter = discordRes.headers.get("Retry-After") || "a few";
            return new Response(JSON.stringify({
              error: "Rate limited by Discord",
              details: `Try again in ${retryAfter} seconds`,
              servers: [],
            }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          if (discordRes.status === 401 || discordRes.status === 403) {
            return new Response(JSON.stringify({
              error: "Discord connection missing required scopes (guilds). Please reconnect Discord.",
              details: `Discord API returned ${discordRes.status}`,
              servers: [],
            }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          if (!discordRes.ok) {
            return new Response(JSON.stringify({
              error: "Failed to load servers",
              details: `Discord API error (HTTP ${discordRes.status})`,
              servers: [],
            }), { status: discordRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          const guilds = JSON.parse(body);

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
        } catch (e) {
          clearTimeout(timeout);
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("[Discord] Guild listing failed:", msg);
          return new Response(JSON.stringify({
            error: "Failed to load servers",
            details: msg,
            servers: [],
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      case "get-channels": {
        if (!serverId) {
          return new Response(JSON.stringify({ error: "serverId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`[Discord] Fetching channels for server: ${serverId}`);

        let creds: { token: string; authHeader: string };
        try {
          creds = await getDiscordCredentials(connectionId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("[Discord] Token retrieval failed:", msg);
          return new Response(JSON.stringify({
            error: "Failed to load channels",
            details: msg,
            channels: [],
          }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Call Discord REST API directly to list guild channels
        const discordController = new AbortController();
        const discordTimeout = setTimeout(() => discordController.abort(), 10000);

        try {
          const discordResponse = await fetch(
            `https://discord.com/api/v10/guilds/${serverId}/channels`,
            {
              headers: { Authorization: creds.authHeader },
              signal: discordController.signal,
            }
          );
          clearTimeout(discordTimeout);

          const discordText = await discordResponse.text();
          console.log(`[Discord] Channel list status: ${discordResponse.status}, body: ${discordText.substring(0, 500)}`);

          if (!discordResponse.ok) {
            const detail = discordResponse.status === 401 || discordResponse.status === 403
              ? "Discord token lacks permission to list channels for this server"
              : `Discord API error (HTTP ${discordResponse.status})`;
            return new Response(JSON.stringify({
              error: "Failed to load channels",
              details: detail,
              channels: [],
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          const allChannels = JSON.parse(discordText);

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
        } catch (e) {
          clearTimeout(discordTimeout);
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("[Discord] Discord API fetch failed:", msg);
          return new Response(JSON.stringify({
            error: "Failed to load channels",
            details: `Channel listing failed: ${msg}`,
            channels: [],
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
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
