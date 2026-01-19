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
  instagram: "ac_INSTAGRAM_CONFIG_ID", // TODO: Replace with actual auth config ID from Composio dashboard
  dropbox: "ac_u-LEALnVXap9",
  googlephotos: "ac_XQf5YL6yOEPG",
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

    const { toolkit, baseUrl } = await req.json();
    const toolkitLower = toolkit?.toLowerCase() || "";
    
    console.log(`Initiating OAuth for toolkit: ${toolkit}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Base URL: ${baseUrl}`);
    
    if (!toolkit || !AUTH_CONFIGS[toolkitLower]) {
      return new Response(
        JSON.stringify({ error: `Invalid toolkit: ${toolkit}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authConfigId = AUTH_CONFIGS[toolkitLower];
    
    // Build the callback URL that Composio will redirect to after OAuth
    const callbackUrl = `${baseUrl}/oauth-complete?toolkit=${toolkitLower}`;
    
    console.log(`=== COMPOSIO OAUTH DEBUG ===`);
    console.log(`Auth Config ID: ${authConfigId}`);
    console.log(`Callback URL (our app): ${callbackUrl}`);
    console.log(`NOTE: Composio uses its own redirect_uri for Google OAuth:`);
    console.log(`  https://backend.composio.dev/api/v3/toolkits/auth/callback`);
    console.log(`This URI must be whitelisted in Google Cloud Console!`);
    console.log(`============================`);

    // Call Composio v3 API /link endpoint
    const composioResponse = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_config_id: authConfigId,
        user_id: user.id,
        // Composio will redirect here after OAuth completes
        // We'll add connectionId and toolkit as query params in the callback
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
    const connectionId = composioData.connected_account_id || composioData.id;
    
    // Get the redirect URL from Composio
    let redirectUrl = composioData.redirect_url || composioData.redirectUrl;
    
    // The Composio callback_url doesn't support dynamic params, so we need to 
    // encode the connectionId in the state or handle it differently
    // Actually, Composio returns the connectionId in the callback URL automatically
    // But we need to ensure our callback URL includes the connectionId
    
    // Update the callback URL in the redirect to include connectionId
    // Composio adds connectionId to the callback automatically, but let's ensure our format
    console.log(`Original redirect URL: ${redirectUrl}`);
    console.log(`Connection ID: ${connectionId}`);

    // Return the redirect URL to frontend
    // The frontend will start polling for this connectionId
    return new Response(
      JSON.stringify({
        redirectUrl,
        connectionId,
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
