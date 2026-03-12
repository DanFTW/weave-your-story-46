import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action } = await req.json();

    // Get the user's Slack access token from user_integrations
    const { data: integration } = await adminClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "slack")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Slack not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The composio_connection_id for native Slack stores the access token
    const slackToken = integration.composio_connection_id;

    // Helper to call Slack API
    async function slackApi(method: string, params: Record<string, any> = {}) {
      const url = new URL(`https://slack.com/api/${method}`);
      // For GET-like methods, use query params; for POST, use JSON body
      const getParams = ["conversations.list", "conversations.history", "users.list"];
      
      if (getParams.includes(method)) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${slackToken}` },
        });
        return resp.json();
      } else {
        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });
        return resp.json();
      }
    }

    if (action === "list-channels") {
      const result = await slackApi("conversations.list", {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
      });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error || "Failed to list channels" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channels = (result.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isMember: ch.is_member ?? false,
        isPrivate: ch.is_private ?? false,
        numMembers: ch.num_members,
      }));

      return new Response(JSON.stringify({ channels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "activate") {
      await adminClient
        .from("slack_messages_config")
        .update({ is_active: true })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      await adminClient
        .from("slack_messages_config")
        .update({ is_active: false })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "poll") {
      // Get config
      const { data: configData } = await adminClient
        .from("slack_messages_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!configData) {
        return new Response(JSON.stringify({ error: "No config found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedChannels = configData.selected_channel_ids || [];
      const isSearchMode = configData.search_mode ?? false;
      let totalImported = 0;

      const liamApiKey = Deno.env.get("LIAM_API_KEY");
      const liamUserKey = Deno.env.get("LIAM_USER_KEY");
      const liamPrivateKey = Deno.env.get("LIAM_PRIVATE_KEY");

      if (!liamApiKey || !liamUserKey || !liamPrivateKey) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isSearchMode) {
        // Search mode: use search.all
        const searchResult = await slackApi("search.all", {
          query: "*",
          count: 50,
          sort: "timestamp",
          sort_dir: "desc",
        });

        if (searchResult.ok && searchResult.messages?.matches) {
          for (const msg of searchResult.messages.matches) {
            const messageId = `${msg.channel?.id || "unknown"}_${msg.ts}`;
            
            // Check if already processed
            const { data: existing } = await adminClient
              .from("slack_processed_messages")
              .select("id")
              .eq("user_id", user.id)
              .eq("slack_message_id", messageId)
              .maybeSingle();

            if (existing) continue;

            // Check if channel is in selected list
            if (selectedChannels.length > 0 && msg.channel?.id && !selectedChannels.includes(msg.channel.id)) {
              continue;
            }

            const memoryContent = `Slack message from ${msg.username || "unknown"} in #${msg.channel?.name || "unknown"}: ${msg.text}`;

            // Save to LIAM
            const liamResp = await fetch("https://api.tryliam.com/api/memories", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": liamApiKey,
                "x-user-key": liamUserKey,
                "x-private-key": liamPrivateKey,
                "x-user-id": user.id,
              },
              body: JSON.stringify({
                content: memoryContent,
                tags: ["SLACK"],
              }),
            });

            if (liamResp.ok) {
              await adminClient.from("slack_processed_messages").insert({
                user_id: user.id,
                slack_message_id: messageId,
              });
              totalImported++;
            }
          }
        }
      } else {
        // Passive mode: fetch recent messages from each selected channel
        for (const channelId of selectedChannels) {
          try {
            const historyResult = await slackApi("conversations.history", {
              channel: channelId,
              limit: 20,
            });

            if (!historyResult.ok) continue;

            for (const msg of historyResult.messages || []) {
              if (msg.subtype) continue; // Skip system messages
              
              const messageId = `${channelId}_${msg.ts}`;

              const { data: existing } = await adminClient
                .from("slack_processed_messages")
                .select("id")
                .eq("user_id", user.id)
                .eq("slack_message_id", messageId)
                .maybeSingle();

              if (existing) continue;

              const memoryContent = `Slack message from ${msg.user || "unknown"}: ${msg.text}`;

              const liamResp = await fetch("https://api.tryliam.com/api/memories", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": liamApiKey,
                  "x-user-key": liamUserKey,
                  "x-private-key": liamPrivateKey,
                  "x-user-id": user.id,
                },
                body: JSON.stringify({
                  content: memoryContent,
                  tags: ["SLACK"],
                }),
              });

              if (liamResp.ok) {
                await adminClient.from("slack_processed_messages").insert({
                  user_id: user.id,
                  slack_message_id: messageId,
                });
                totalImported++;
              }
            }
          } catch (err) {
            console.error(`Failed to fetch history for channel ${channelId}:`, err);
          }
        }
      }

      // Update stats
      await adminClient
        .from("slack_messages_config")
        .update({
          messages_imported: (configData.messages_imported || 0) + totalImported,
          last_polled_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, messagesImported: totalImported }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("slack-messages-sync error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
