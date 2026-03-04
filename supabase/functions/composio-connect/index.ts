import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

// Map our internal toolkit IDs to Composio's expected toolkit names (for dynamic auth config lookup)
const COMPOSIO_TOOLKIT_NAMES: Record<string, string> = {
  googledrive: "GOOGLEDRIVE",
  googlephotos: "GOOGLE_PHOTOS",
  googledocs: "GOOGLE_DOCS",
  googletasks: "GOOGLE_TASKS",
  googlesuper: "GOOGLE",
  googlecalendar: "GOOGLECALENDAR",
};

// Fetch the default Composio-managed auth config for a toolkit
async function getDefaultAuthConfigId(toolkit: string): Promise<string | null> {
  try {
    const composioName = COMPOSIO_TOOLKIT_NAMES[toolkit] || toolkit.toUpperCase();
    const response = await fetch(
      `https://backend.composio.dev/api/v3/auth_configs?toolkit_slug=${composioName}&is_composio_managed=true`,
      {
        method: "GET",
        headers: {
          "x-api-key": COMPOSIO_API_KEY!,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log(`Auth config API response for ${composioName} (status ${response.status}): ${responseText}`);

    if (!response.ok) {
      console.error(`Failed to fetch auth configs for ${toolkit}: ${response.status}`);
      return null;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error(`Non-JSON response for ${composioName}: ${responseText}`);
      return null;
    }
    
    // Find the default/enabled Composio-managed auth config
    const authConfigs = data.items || [];
    const defaultConfig = authConfigs.find(
      (config: { is_composio_managed?: boolean; status?: string }) => 
        config.is_composio_managed && config.status === "ENABLED"
    );

    if (defaultConfig) {
      console.log(`Found default auth config for ${toolkit}: ${defaultConfig.id}`);
      return defaultConfig.id;
    }

    console.log(`No default auth config found for ${toolkit}`);
    return null;
  } catch (error) {
    console.error(`Error fetching auth config for ${toolkit}:`, error);
    return null;
  }
}

// Auth config IDs from Composio dashboard (custom configs)
// If a toolkit is not listed here, we'll dynamically fetch Composio's default managed auth
const AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_JO3RFglIYYKs",
  instagram: "ac_N2MwqGEh7F7y",
  dropbox: "ac_u-LEALnVXap9",
  googlephotos: "ac_XQf5YL6yOEPG",
  twitter: "ac_4qhrV_9j3cxB",
  youtube: "ac_LwcJYIIYufYK",
  whatsapp: "ac_XmoxkDSq-Uwu",
  outlook: "ac_lmdOfsms5fSG",
  teams: "ac_rVyo3ZPHW1OL",
  excel: "ac_QMjsg-1512FZ",
  linkedin: "ac_kzzsdBscCW-a",
  discord: "ac_BOCrE-Q-yqJu",
  discordbot: "ac_jECZy5E0ycKY",
  googledocs: "ac_L-liU4EHxioi",
  trello: "ac_1s6sLEKtkxuE",
  github: "ac_kDM61t-M_opS",
  linear: "ac_epJLkL96tTtx",
  onedrive: "ac_SArQwT66owIm",
  todoist: "ac_E90ichFZZyZo",
  zoom: "ac_R8STImJTk1NU",
  docusign: "ac_ZRpGACBv5_5c",
  canva: "ac_zEU1TJt4cJ7K",
  eventbrite: "ac_qIPkRJIL1DT1",
  googletasks: "ac_KaK1VD0skDww",
  monday: "ac_qtj0haSLNPl1",
  supabase: "ac_NFPURhvXB8VS",
  figma: "ac_O8Bq53XXRxZX",
  reddit: "ac_IgIttAjDSfm6",
  stripe: "ac_1F7u7TnRQmvP",
  hubspot: "ac_1B61iXhr6Dil",
  bitbucket: "ac_0B8ht8fYcTJs",
  clickup: "ac_4dAJHY9mAppo",
  confluence: "ac_bnJpBR_xB3qK",
  mailchimp: "ac_HJxEfhlNVa8Y",
  attio: "ac_W5C1G-fdQh11",
  notion: "ac_OhQUfFIwuj3R",
  strava: "ac_LUjuTEN_sarA",
  perplexity: "ac_mfa9ErILfDh-",
  ticketmaster: "ac_4zrDFu1D4q3q",
  facebook: "ac_wzCdTDITid_K",
  box: "ac_wBJCQEG3imPm",
  googlesuper: "ac_2kVKJUxBH97r",
  fireflies: "ac_67tCzpRn7AdZ",
  slack: "ac_H9kYZsVaw_gS",
  googlecalendar: "ac_Tahf9NrBD7Vy",
  googlemaps: "ac_dg71KiJ5nLgN",
};

// All valid toolkits (includes those using Composio default auth)
const VALID_TOOLKITS = [
  "gmail", "instagram", "dropbox", "googlephotos", "twitter",
  "youtube", "whatsapp", "outlook", "teams", "excel",
  "linkedin", "discord", "discordbot", "googledocs", "trello", "github", "linear", "onedrive", "todoist", "zoom", "docusign", "canva", "eventbrite", "googletasks", "monday", "supabase", "figma", "reddit", "stripe", "hubspot", "bitbucket", "clickup", "confluence", "mailchimp", "attio", "notion", "strava", "perplexity", "ticketmaster", "facebook", "box", "googlesuper", "fireflies", "googledrive", "slack", "googlecalendar", "googlemaps"
];

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

    const { toolkit, baseUrl, forceReauth = false } = await req.json();
    const toolkitLower = toolkit?.toLowerCase() || "";
    
    console.log(`Initiating OAuth for toolkit: ${toolkit}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Base URL: ${baseUrl}`);
    
    // Validate toolkit is in our allowed list
    if (!toolkit || !VALID_TOOLKITS.includes(toolkitLower)) {
      return new Response(
        JSON.stringify({ error: `Invalid toolkit: ${toolkit}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if we have a custom auth config, otherwise fetch default from Composio
    let authConfigId: string | undefined = AUTH_CONFIGS[toolkitLower];
    
    // If no custom auth config, fetch the default Composio-managed one
    if (!authConfigId) {
      console.log(`No custom auth config for ${toolkitLower}, fetching Composio default...`);
      const defaultConfigId = await getDefaultAuthConfigId(toolkitLower);
      
      if (!defaultConfigId) {
        return new Response(
          JSON.stringify({ error: `No auth config available for ${toolkit}. Please configure it in Composio dashboard.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      authConfigId = defaultConfigId;
    }
    
    // Build the callback URL that Composio will redirect to after OAuth
    const callbackUrl = `${baseUrl}/oauth-complete?toolkit=${toolkitLower}`;
    
    console.log(`=== COMPOSIO OAUTH DEBUG ===`);
    console.log(`Auth Config ID: ${authConfigId}`);
    console.log(`Toolkit: ${toolkitLower.toUpperCase()}`);
    console.log(`Callback URL (our app): ${callbackUrl}`);
    console.log(`============================`);

    // Build request body - always use auth_config_id (required by Composio v3 API)
    const requestBody: Record<string, unknown> = {
      auth_config_id: authConfigId,
      user_id: user.id,
      callback_url: callbackUrl,
      ...(forceReauth && { force_reauth: true }),
    };

    console.log(`Composio request body:`, JSON.stringify(requestBody));

    // Call Composio v3 API /link endpoint
    const composioResponse = await fetch("https://backend.composio.dev/api/v3/connected_accounts/link", {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
