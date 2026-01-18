import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

// Auth config IDs from Composio dashboard
// Each toolkit maps to its auth config ID
const AUTH_CONFIGS: Record<string, string> = {
  gmail: "ac_JO3RFglIYYKs",
  instagram: "ac_INSTAGRAM_CONFIG_ID", // TODO: Replace with actual auth config ID
  googlephotos: "ac_nazoF6ohFfId",
};

// Canonical toolkit slugs (lowercase, no special chars) as per Composio API
// Used to validate and normalize toolkit names
const VALID_TOOLKITS = new Set([
  "gmail",
  "instagram", 
  "googlephotos",
  "spotify",
  "youtube",
  "pinterest",
  "googledrive",
]);

// Aliases for toolkit resolution (handles common variations)
const TOOLKIT_ALIASES: Record<string, string> = {
  "google_photos": "googlephotos",
  "googlephoto": "googlephotos",
  "photos": "googlephotos",
  "google_drive": "googledrive",
  "gdrive": "googledrive",
  "googlemail": "gmail",
  "google_gmail": "gmail",
};

/**
 * Resolves a toolkit identifier to its canonical form.
 * Returns null if the toolkit is not supported.
 */
function resolveToolkit(toolkit: string): string | null {
  if (!toolkit) return null;
  
  const normalized = toolkit.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Check if it's already a valid canonical toolkit
  if (VALID_TOOLKITS.has(normalized)) {
    return normalized;
  }
  
  // Check aliases
  const originalLower = toolkit.toLowerCase().replace(/\s+/g, "_");
  if (TOOLKIT_ALIASES[originalLower]) {
    return TOOLKIT_ALIASES[originalLower];
  }
  
  // Check normalized against aliases
  for (const [alias, canonical] of Object.entries(TOOLKIT_ALIASES)) {
    if (alias.replace(/[^a-z0-9]/g, "") === normalized) {
      return canonical;
    }
  }
  
  return null;
}

/**
 * Fetches available toolkits from Composio API to validate toolkit availability
 */
async function fetchAvailableToolkits(): Promise<string[]> {
  try {
    const response = await fetch("https://backend.composio.dev/api/v3/toolkits?limit=100", {
      headers: { "x-api-key": COMPOSIO_API_KEY! },
    });
    
    if (!response.ok) {
      console.error("Failed to fetch toolkits from Composio:", response.status);
      return [];
    }
    
    const data = await response.json();
    const toolkits = data.items?.map((t: { slug?: string }) => t.slug?.toLowerCase()).filter(Boolean) || [];
    console.log(`Fetched ${toolkits.length} available toolkits from Composio`);
    return toolkits;
  } catch (error) {
    console.error("Error fetching toolkits:", error);
    return [];
  }
}

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
    
    console.log(`Initiating OAuth for toolkit: ${toolkit}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Base URL: ${baseUrl}`);
    
    // Step 1: Resolve toolkit to canonical form
    const resolvedToolkit = resolveToolkit(toolkit);
    
    if (!resolvedToolkit) {
      console.error(`Invalid toolkit requested: ${toolkit}`);
      
      // Fetch available toolkits for helpful error message
      const availableToolkits = await fetchAvailableToolkits();
      const configuredToolkits = Object.keys(AUTH_CONFIGS);
      
      return new Response(
        JSON.stringify({ 
          error: `Invalid toolkit: "${toolkit}"`,
          message: "The requested toolkit is not supported. Please check the toolkit name.",
          configured_toolkits: configuredToolkits,
          hint: "Valid toolkit names: " + configuredToolkits.join(", ")
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Resolved toolkit: ${toolkit} -> ${resolvedToolkit}`);
    
    // Step 2: Check if we have an auth config for this toolkit
    const authConfigId = AUTH_CONFIGS[resolvedToolkit];
    
    if (!authConfigId) {
      console.error(`No auth config for toolkit: ${resolvedToolkit}`);
      
      return new Response(
        JSON.stringify({ 
          error: `Toolkit "${resolvedToolkit}" is not configured`,
          message: "This integration is recognized but not yet configured. Please contact support.",
          configured_toolkits: Object.keys(AUTH_CONFIGS),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Using auth config: ${authConfigId} for toolkit: ${resolvedToolkit}`);

    // Step 3: Call Composio v3 API /link endpoint
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
        callback_url: `${baseUrl}/oauth-complete?toolkit=${resolvedToolkit}`,
      }),
    });

    const responseText = await composioResponse.text();
    console.log(`Composio response status: ${composioResponse.status}`);
    console.log(`Composio response: ${responseText}`);

    if (!composioResponse.ok) {
      console.error("Composio API error:", composioResponse.status, responseText);
      
      // Parse error for better messaging
      let errorMessage = `Composio API error: ${composioResponse.status}`;
      let errorDetails = responseText;
      
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.error) {
          errorMessage = errorData.error;
          errorDetails = errorData.message || errorData.detail || responseText;
        }
        
        // Check for specific "Invalid toolkit" error from Composio
        if (errorMessage.toLowerCase().includes("invalid toolkit") || 
            errorDetails.toLowerCase().includes("invalid toolkit")) {
          return new Response(
            JSON.stringify({
              error: "Invalid toolkit configuration",
              message: `The auth config for "${resolvedToolkit}" may be incorrect or the toolkit is not available in your Composio account.`,
              toolkit: resolvedToolkit,
              auth_config_id: authConfigId,
              hint: "Please verify the auth_config_id in your Composio dashboard.",
            }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        // Keep original error message if parsing fails
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorDetails,
          toolkit: resolvedToolkit,
        }),
        { status: composioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const composioData = JSON.parse(responseText);
    const connectionId = composioData.connected_account_id || composioData.id;
    
    // Get the redirect URL from Composio
    const redirectUrl = composioData.redirect_url || composioData.redirectUrl;
    
    console.log(`OAuth initiated successfully`);
    console.log(`Redirect URL: ${redirectUrl}`);
    console.log(`Connection ID: ${connectionId}`);

    // Return the redirect URL to frontend
    return new Response(
      JSON.stringify({
        redirectUrl,
        connectionId,
        toolkit: resolvedToolkit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in composio-connect:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        message: "An unexpected error occurred while initiating the connection. Please try again."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
