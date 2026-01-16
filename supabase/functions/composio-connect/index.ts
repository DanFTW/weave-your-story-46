import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

// Auth config IDs from Composio dashboard
const AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_JO3RFglIYYKs",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { toolkit, redirectUrl } = await req.json();
    const toolkitLower = toolkit?.toLowerCase() || "";
    
    console.log(`Initiating OAuth for toolkit: ${toolkit}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Redirect URL: ${redirectUrl}`);
    
    if (!toolkit || !AUTH_CONFIGS[toolkitLower]) {
      return new Response(
        JSON.stringify({ error: `Invalid toolkit: ${toolkit}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authConfigId = AUTH_CONFIGS[toolkitLower];
    const callbackUrl = redirectUrl || `${req.headers.get("origin")}/integration/${toolkitLower}?connected=true`;

    console.log(`Using auth config: ${authConfigId}`);
    console.log(`Callback URL: ${callbackUrl}`);

    // Call Composio v3 API /link endpoint - this is the working pattern
    const composioResponse = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_config_id: authConfigId,
        user_id: user.id,
        callback_url: callbackUrl,
      }),
    });

    const responseText = await composioResponse.text();
    console.log(`Composio response status: ${composioResponse.status}`);
    console.log(`Composio response: ${responseText}`);

    if (!composioResponse.ok) {
      console.error("Composio API error:", composioResponse.status, responseText);
      throw new Error(`Composio API error: ${composioResponse.status}`);
    }

    const composioData = JSON.parse(responseText);

    // Return the redirect URL to frontend
    return new Response(
      JSON.stringify({
        redirectUrl: composioData.redirect_url || composioData.redirectUrl,
        connectionId: composioData.connected_account_id || composioData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in composio-connect:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
