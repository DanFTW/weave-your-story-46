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
    const { action, query } = await req.json();

    // Get the Slack user token from Supabase secrets
    const slackToken = Deno.env.get("SLACK_USER_TOKEN");

    if (!slackToken) {
      const missingTokenPayload = {
        error: "Slack not connected",
        code: "SLACK_TOKEN_MISSING",
        needsReconnect: true,
      };

      if (action === "list-channels") {
        return new Response(JSON.stringify(missingTokenPayload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(missingTokenPayload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function slackApi(method: string, params: Record<string, any> = {}) {
      const url = new URL(`https://slack.com/api/${method}`);
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

      const channelId = (configData.selected_channel_ids || [])[0];
      if (!channelId) {
        return new Response(JSON.stringify({ error: "No channel selected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const liamApiKey = Deno.env.get("LIAM_API_KEY");
      const liamUserKey = Deno.env.get("LIAM_USER_KEY");
      const liamPrivateKey = Deno.env.get("LIAM_PRIVATE_KEY");

      if (!liamApiKey || !liamUserKey || !liamPrivateKey) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalImported = 0;

      try {
        const historyResult = await slackApi("conversations.history", {
          channel: channelId,
          limit: 20,
        });

        if (historyResult.ok) {
          for (const msg of historyResult.messages || []) {
            if (msg.subtype) continue;

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
        }
      } catch (err) {
        console.error(`Failed to fetch history for channel ${channelId}:`, err);
      }

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

    if (action === "search") {
      if (!query) {
        return new Response(JSON.stringify({ error: "Query required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      const channelId = (configData.selected_channel_ids || [])[0];
      const channelName = (configData.selected_workspace_ids || [])[0];
      const searchQuery = channelName ? `in:#${channelName} ${query}` : query;

      const liamApiKey = Deno.env.get("LIAM_API_KEY");
      const liamUserKey = Deno.env.get("LIAM_USER_KEY");
      const liamPrivateKey = Deno.env.get("LIAM_PRIVATE_KEY");

      if (!liamApiKey || !liamUserKey || !liamPrivateKey) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalImported = 0;

      const searchResult = await slackApi("search.all", {
        query: searchQuery,
        count: 50,
        sort: "timestamp",
        sort_dir: "desc",
      });

      if (searchResult.ok && searchResult.messages?.matches) {
        for (const msg of searchResult.messages.matches) {
          const messageId = `${msg.channel?.id || "unknown"}_${msg.ts}`;

          const { data: existing } = await adminClient
            .from("slack_processed_messages")
            .select("id")
            .eq("user_id", user.id)
            .eq("slack_message_id", messageId)
            .maybeSingle();

          if (existing) continue;

          const memoryContent = `Slack message from ${msg.username || "unknown"} in #${msg.channel?.name || "unknown"}: ${msg.text}`;

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
