// Composio OAuth Connection Handler v2 - Updated 2026-01-18
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

// Auth config IDs from Composio dashboard
// Keys MUST be lowercase - lookups are normalized to lowercase
const AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_JO3RFglIYYKs",
  googlephotos: "ac_nazoF6ohFfId",
  instagram: "ac_INSTAGRAM_CONFIG_ID",
};

serve(async (req) => {
  console.log("composio-connect: Request received");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY) {
      console.error("COMPOSIO_API_KEY is not configured");
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
    
    // Normalize toolkit to lowercase for lookup
    const toolkitLower = (toolkit || "").toLowerCase().trim();
    
    console.log(`composio-connect: Received toolkit="${toolkit}", normalized="${toolkitLower}"`);
    console.log(`composio-connect: User ID: ${user.id}`);
    console.log(`composio-connect: Base URL: ${baseUrl}`);
    console.log(`composio-connect: Available configs: ${JSON.stringify(Object.keys(AUTH_CONFIGS))}`);
    
    // Check if toolkit exists in our config
    const authConfigId = AUTH_CONFIGS[toolkitLower];
    
    if (!toolkitLower || !authConfigId) {
      console.error(`composio-connect: Invalid toolkit "${toolkit}" (normalized: "${toolkitLower}")`);
      console.error(`composio-connect: Available toolkits: ${Object.keys(AUTH_CONFIGS).join(", ")}`);
      return new Response(
        JSON.stringify({ 
          error: `Invalid toolkit: ${toolkit}`,
          available: Object.keys(AUTH_CONFIGS),
          received: toolkitLower
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`composio-connect: Using auth config ID: ${authConfigId}`);

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
        callback_url: `${baseUrl}/oauth-complete?toolkit=${toolkitLower}`,
      }),
    });

    const responseText = await composioResponse.text();
    console.log(`composio-connect: Composio response status: ${composioResponse.status}`);
    console.log(`composio-connect: Composio response: ${responseText}`);

    if (!composioResponse.ok) {
      console.error("composio-connect: Composio API error:", composioResponse.status, responseText);
      throw new Error(`Composio API error: ${composioResponse.status}`);
    }

    const composioData = JSON.parse(responseText);
    const connectionId = composioData.connected_account_id || composioData.id;
    const redirectUrl = composioData.redirect_url || composioData.redirectUrl;
    
    console.log(`composio-connect: Redirect URL: ${redirectUrl}`);
    console.log(`composio-connect: Connection ID: ${connectionId}`);

    return new Response(
      JSON.stringify({
        redirectUrl,
        connectionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("composio-connect: Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
