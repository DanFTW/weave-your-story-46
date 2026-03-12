import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SLACK_USER_SCOPES = "channels:read,channels:history,search:read,users:read";
const REDIRECT_URI = "https://weave-your-story-46.lovable.app/oauth-complete";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, code, userId: bodyUserId } = body;
    const authHeader = req.headers.get("Authorization");

    // ---------- INITIATE ----------
    if (action === "initiate") {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authorization required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = `slack_${user.id}`;
      const redirectUrl = `https://slack.com/oauth/v2/authorize?` +
        `client_id=${SLACK_CLIENT_ID}` +
        `&user_scope=${encodeURIComponent(SLACK_USER_SCOPES)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&state=${encodeURIComponent(state)}`;

      console.log("slack-oauth: initiate for user", user.id);

      return new Response(JSON.stringify({ redirectUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- CALLBACK ----------
    if (action === "callback") {
      if (!code) {
        return new Response(JSON.stringify({ error: "Missing code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("slack-oauth: exchanging code for token...");

      // Exchange code for token
      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID!,
          client_secret: SLACK_CLIENT_SECRET!,
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();
      console.log("slack-oauth: token response ok:", tokenData.ok);

      if (!tokenData.ok) {
        console.error("slack-oauth: token exchange failed:", tokenData.error);
        return new Response(
          JSON.stringify({ success: false, error: `Slack error: ${tokenData.error}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For user token scopes, token is in authed_user
      const userToken = tokenData.authed_user?.access_token;
      const slackUserId = tokenData.authed_user?.id;

      if (!userToken) {
        console.error("slack-oauth: no user access token in response");
        return new Response(
          JSON.stringify({ success: false, error: "No user token received from Slack" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch user profile
      let accountName = "";
      let accountEmail = "";
      let avatarUrl = "";

      try {
        const userInfoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
          headers: { Authorization: `Bearer ${userToken}` },
        });
        const userInfo = await userInfoRes.json();
        if (userInfo.ok && userInfo.user) {
          accountName = userInfo.user.real_name || userInfo.user.name || "";
          accountEmail = userInfo.user.profile?.email || "";
          avatarUrl = userInfo.user.profile?.image_72 || "";
        }
        console.log("slack-oauth: user info:", { accountName, accountEmail });
      } catch (e) {
        console.error("slack-oauth: failed to fetch user info:", e);
      }

      // Determine user ID from auth header or body
      let userId: string | null = null;
      if (authHeader) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      if (!userId) userId = bodyUserId || null;

      if (!userId) {
        console.error("slack-oauth: could not determine user ID");
        return new Response(
          JSON.stringify({ success: false, error: "Could not identify user" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use service role to upsert
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { error: upsertError } = await adminSupabase
        .from("user_integrations")
        .upsert(
          {
            user_id: userId,
            integration_id: "slack",
            status: "connected",
            account_name: accountName || tokenData.team?.name || "",
            account_email: accountEmail,
            account_avatar_url: avatarUrl,
            connected_at: new Date().toISOString(),
            composio_connection_id: null,
          },
          { onConflict: "user_id,integration_id" }
        );

      if (upsertError) {
        console.error("slack-oauth: upsert error:", upsertError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to save connection" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("slack-oauth: saved for user", userId);

      return new Response(
        JSON.stringify({ success: true, toolkit: "slack" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("slack-oauth: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
