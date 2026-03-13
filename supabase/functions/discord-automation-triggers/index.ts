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

type DiscordAuthScheme = "Bot" | "Bearer";

/**
 * Fetch the Discord access token and its type from Composio connected-account metadata.
 * Optionally accepts an overrideScheme to retry with the opposite auth scheme on 401.
 */
async function getDiscordCredentials(
  connectionId: string,
  overrideScheme?: DiscordAuthScheme,
): Promise<{ token: string; authHeader: string; scheme: DiscordAuthScheme }> {
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
    const token = meta?.connectionParams?.access_token
      || meta?.data?.access_token
      || meta?.data?.params?.access_token
      || meta?.data?.connectionParams?.access_token
      || meta?.data?.connection_params?.access_token;

    if (!token) {
      throw new Error("No access_token in Composio metadata. Please reconnect Discord.");
    }

    // Trust the token_type from Composio metadata rather than inferring from toolkit slug
    const tokenType = meta?.connectionParams?.token_type || meta?.data?.token_type || "Bearer";
    const toolkitSlug = meta?.toolkit?.slug || meta?.auth_config?.toolkit_slug || "";
    const inferredScheme: DiscordAuthScheme = tokenType === "Bot" ? "Bot" : "Bearer";
    const scheme = overrideScheme ?? inferredScheme;

    const authHeader = `${scheme} ${token}`;
    console.log(`[Discord] Token type resolved: ${scheme} (toolkit: ${toolkitSlug}, tokenType: ${tokenType}, override: ${overrideScheme ?? "none"})`);

    return { token, authHeader, scheme };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/**
 * Fetch guilds for a given connection ID from Discord API.
 * Returns array of { id, name, icon } or null on failure.
 */
async function fetchGuildsForConnection(connId: string): Promise<{ id: string; name: string; icon: string | null }[] | null> {
  let creds;
  try {
    creds = await getDiscordCredentials(connId);
  } catch (e) {
    console.error(`[Discord] Token retrieval failed for ${connId}:`, e instanceof Error ? e.message : e);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: creds.authHeader },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const body = await res.text();
    console.log(`[Discord] Guilds API status: ${res.status} (conn: ${connId}), body length: ${body.length}`);

    if (!res.ok) return null;

    const guilds = JSON.parse(body);
    return Array.isArray(guilds)
      ? guilds.map((g: any) => ({ id: g.id, name: g.name, icon: g.icon || null }))
      : null;
  } catch (e) {
    clearTimeout(timeout);
    console.error(`[Discord] Guild listing failed for ${connId}:`, e instanceof Error ? e.message : e);
    return null;
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

    // Get user's Discord connections (check both 'discord' and 'discordbot' integration IDs)
    const { data: integrations } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id, integration_id")
      .eq("user_id", user.id)
      .in("integration_id", ["discord", "discordbot"])
      .eq("status", "connected");

    // Prefer the 'discord' (user OAuth) connection, fall back to 'discordbot'
    const discordIntegration = integrations?.find((i) => i.integration_id === "discord");
    const botIntegration = integrations?.find((i) => i.integration_id === "discordbot");
    const integration = discordIntegration || botIntegration;

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Discord not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect all unique valid connection IDs, preferring regular Discord OAuth first
    const allConnectionIds = [
      discordIntegration?.composio_connection_id,
      botIntegration?.composio_connection_id,
    ].filter((id): id is string => !!id && id.startsWith("ca_"));
    const connectionIdsToUse = [...new Set(allConnectionIds)];
    const connectionId = connectionIdsToUse[0];

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
        // Fetch guilds from BOTH user OAuth and bot connections, return intersection
        const userConnId = discordIntegration?.composio_connection_id;
        const botConnId = botIntegration?.composio_connection_id;

        console.log(`[Discord] get-servers: userConn=${userConnId}, botConn=${botConnId}`);

        // Fetch bot guilds first (required for intersection)
        let botGuilds: { id: string; name: string; icon: string | null }[] | null = null;
        if (botConnId) {
          botGuilds = await fetchGuildsForConnection(botConnId);
          console.log(`[Discord] Bot guilds: ${botGuilds ? botGuilds.length : "failed"}`);
        }

        // Fetch user guilds (for display names / broader list)
        let userGuilds: { id: string; name: string; icon: string | null }[] | null = null;
        if (userConnId && userConnId !== botConnId) {
          userGuilds = await fetchGuildsForConnection(userConnId);
          console.log(`[Discord] User guilds: ${userGuilds ? userGuilds.length : "failed"}`);
        }

        // If bot guilds available, return intersection (or just bot guilds if no separate user conn)
        if (botGuilds && botGuilds.length > 0) {
          if (userGuilds && userGuilds.length > 0) {
            // Intersection: only servers where both user AND bot are present
            const botGuildIds = new Set(botGuilds.map(g => g.id));
            const intersected = userGuilds.filter(g => botGuildIds.has(g.id));
            console.log(`[Discord] Intersection: ${intersected.length} servers`);

            if (intersected.length > 0) {
              return new Response(JSON.stringify({ servers: intersected }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            // No intersection — bot is in servers the user isn't in (unusual), return bot guilds
            return new Response(JSON.stringify({ servers: botGuilds }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // No separate user connection or user guild fetch failed — just return bot guilds
          return new Response(JSON.stringify({ servers: botGuilds }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Bot guilds failed or empty — fall back to user guilds with a warning
        if (userGuilds && userGuilds.length > 0) {
          return new Response(JSON.stringify({
            servers: userGuilds,
            warning: "The Discord bot is not in any of your servers. Channel listing may fail. Please add the bot to the server you want to monitor.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Everything failed
        return new Response(JSON.stringify({
          error: "Could not load Discord servers. Please reconnect Discord.",
          details: "All available Discord connections failed to list servers.",
          servers: [],
          requiresReconnect: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get-channels": {
        if (!serverId) {
          return new Response(JSON.stringify({ error: "serverId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Use the real Discord Bot token from secrets — OAuth2 tokens don't work for guild channel listing
        const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
        if (!botToken) {
          console.error("[Discord] DISCORD_BOT_TOKEN secret is missing");
          return new Response(JSON.stringify({
            error: "Discord bot token not configured. Please contact support.",
            channels: [],
            requiresReconnect: false,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const channelUrl = `https://discord.com/api/v10/guilds/${serverId}/channels`;
        console.log(`[Discord] Fetching channels for server ${serverId} using DISCORD_BOT_TOKEN`);

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 10_000);
        try {
          const discordRes = await fetch(channelUrl, {
            headers: { Authorization: `Bot ${botToken}` },
            signal: ctrl.signal,
          });
          clearTimeout(t);

          const body = await discordRes.text();
          console.log(`[Discord] Channels API status: ${discordRes.status}, body: ${body.substring(0, 500)}`);

          if (discordRes.status === 429) {
            const retryAfter = discordRes.headers.get("Retry-After") || "a few";
            return new Response(JSON.stringify({
              error: "Rate limited by Discord",
              details: `Try again in ${retryAfter} seconds`,
              channels: [],
              requiresReconnect: false,
            }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          if (discordRes.status === 401) {
            return new Response(JSON.stringify({
              error: "Discord bot token is invalid or expired. Please update the DISCORD_BOT_TOKEN secret.",
              channels: [],
              requiresReconnect: true,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          if (discordRes.status === 403) {
            return new Response(JSON.stringify({
              error: "Bot does not have access to this server. Please add the bot to the server or choose a different one.",
              details: "The bot lacks permissions for this server's channels.",
              channels: [],
              requiresReconnect: false,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          if (!discordRes.ok) {
            return new Response(JSON.stringify({
              error: "Failed to load channels",
              details: `Discord API error (HTTP ${discordRes.status})`,
              channels: [],
              requiresReconnect: false,
            }), { status: discordRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          const allChannels = JSON.parse(body);
          const textChannels = Array.isArray(allChannels)
            ? allChannels
                .filter((c: any) => c.type === 0 || c.type === 5)
                .map((c: any) => ({ id: c.id, name: c.name, type: c.type }))
            : [];

          return new Response(JSON.stringify({ channels: textChannels, requiresReconnect: false }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          clearTimeout(t);
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error(`[Discord] Channel listing failed:`, msg);
          return new Response(JSON.stringify({
            error: "Failed to load channels",
            details: msg,
            channels: [],
            requiresReconnect: false,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      case "reconnect": {
        // Use the correct discordbot auth config (matching composio-connect)
        const DISCORD_AUTH_CONFIG_ID = "ac_jECZy5E0ycKY";
        // Build a callback URL the user returns to after OAuth
        const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
        const callbackUrl = `${origin}/oauth-complete?toolkit=discordbot`;

        console.log("[Discord] Reconnect: using v3 /link endpoint, auth_config_id:", DISCORD_AUTH_CONFIG_ID);

        const initiateRes = await fetch(
          `${COMPOSIO_API_BASE}/connected_accounts/link`,
          {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              auth_config_id: DISCORD_AUTH_CONFIG_ID,
              user_id: user.id,
              callback_url: callbackUrl,
              force_reauth: true,
            }),
          }
        );

        const initiateData = await safeJsonParse(initiateRes);
        console.log("[Discord] Reconnect initiate response:", JSON.stringify(initiateData));

        if (!initiateRes.ok || !(initiateData?.redirect_url || initiateData?.redirectUrl)) {
          return new Response(JSON.stringify({
            error: "Failed to initiate Discord reconnection",
            details: initiateData?.message || initiateData?.error?.message || `HTTP ${initiateRes.status}`,
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          redirectUrl: initiateData.redirect_url || initiateData.redirectUrl,
        }), {
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
