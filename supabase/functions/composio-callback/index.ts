import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Helper to decode JWT payload (no verification needed, just extraction)
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

// Map Composio app keys to our integration IDs
const APP_TO_TOOLKIT: Record<string, string> = {
  "gmail": "gmail",
  "googlemail": "gmail", 
  "google_gmail": "gmail",
  "spotify": "spotify",
  "instagram": "instagram",
  "youtube": "youtube",
  "pinterest": "pinterest",
  "dropbox": "dropbox",
  "googlephotos": "googlephotos",
  "google_photos": "googlephotos",
  "googlephoto": "googlephotos",
  "twitter": "twitter",
  "x": "twitter",
  "twitter_x": "twitter",
  "whatsapp": "whatsapp",
  "whatsapp_business": "whatsapp",
  "whatsappbusiness": "whatsapp",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing required environment variables");
      throw new Error("Server configuration error");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { connectionId, userId, toolkit: toolkitFromRequest } = await req.json();

    console.log(`composio-callback: Processing connectionId=${connectionId}, userId=${userId}, toolkit=${toolkitFromRequest}`);

    if (!connectionId) {
      console.error("composio-callback: Missing connectionId");
      return new Response(
        JSON.stringify({ success: false, error: "Missing connectionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch connection details from Composio v3 API
    console.log(`composio-callback: Fetching connection details from Composio...`);
    const composioResponse = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        headers: { "x-api-key": COMPOSIO_API_KEY },
      }
    );

    const responseText = await composioResponse.text();
    console.log(`composio-callback: Composio response status=${composioResponse.status}`);
    console.log(`composio-callback: Composio response body=${responseText}`);

    if (!composioResponse.ok) {
      console.error("composio-callback: Failed to fetch connection from Composio");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to verify connection with provider",
          status: composioResponse.status 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountData = JSON.parse(responseText);
    const connectionStatus = accountData.status || "UNKNOWN";
    
    console.log(`composio-callback: Connection status=${connectionStatus}`);
    console.log(`composio-callback: Account data keys: ${Object.keys(accountData).join(", ")}`);

    if (connectionStatus !== "ACTIVE" && connectionStatus !== "active") {
      console.log("composio-callback: Connection not active yet");
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: connectionStatus, 
          message: "Connection not active yet. Please complete the OAuth flow." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract toolkit from Composio response if not provided
    // The response contains app_unique_id or appUniqueId which identifies the service
    let toolkit = toolkitFromRequest?.toLowerCase();
    
    if (!toolkit) {
      const appId = accountData.app_unique_id || accountData.appUniqueId || 
                    accountData.app_id || accountData.appId ||
                    accountData.app?.key || accountData.app?.name || "";
      
      const normalizedAppId = appId.toLowerCase().replace(/[^a-z]/g, "");
      toolkit = APP_TO_TOOLKIT[normalizedAppId] || normalizedAppId || "unknown";
      
      console.log(`composio-callback: Resolved toolkit from Composio: appId=${appId} -> toolkit=${toolkit}`);
    }

    // Extract user ID from the connection if not provided (for App Browser context)
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      // Try to get user_id from the Composio connection data
      // Composio stores the user_id we passed during connection initiation
      resolvedUserId = accountData.user_id || accountData.userId || accountData.member_id;
      console.log(`composio-callback: Resolved userId from Composio: ${resolvedUserId}`);
    }

    if (!resolvedUserId) {
      console.error("composio-callback: Could not determine user ID");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not determine user. Please try reconnecting." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user info from the OAuth data
    const data = accountData.data || accountData.connection_params || {};
    let accountEmail: string | null = null;
    let accountName: string | null = null;
    let accountAvatarUrl: string | null = null;

    // Try to decode the id_token (Google OAuth includes user info in JWT)
    if (data.id_token) {
      const jwtPayload = decodeJwtPayload(data.id_token);
      if (jwtPayload) {
        accountEmail = (jwtPayload.email as string) || null;
        accountName = (jwtPayload.name as string) || null;
        accountAvatarUrl = (jwtPayload.picture as string) || null;
        console.log(`composio-callback: Extracted from id_token - email=${accountEmail}, name=${accountName}`);
      }
    }

    // Fallback to other possible locations in the response
    if (!accountEmail) {
      accountEmail = data.user_email || data.email || 
                     accountData.user_email || accountData.email || null;
      accountName = data.name || data.display_name || 
                    accountData.name || accountData.display_name || null;
      console.log(`composio-callback: Fallback extraction - email=${accountEmail}, name=${accountName}`);
    }

    console.log(`composio-callback: Final account info - email=${accountEmail}, name=${accountName}, toolkit=${toolkit}`);

    // Upsert to user_integrations table using service role (works from App Browser context)
    const { data: savedData, error: dbError } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: resolvedUserId,
        integration_id: toolkit,
        composio_connection_id: connectionId,
        status: "connected",
        account_email: accountEmail,
        account_name: accountName,
        account_avatar_url: accountAvatarUrl,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,integration_id"
      })
      .select()
      .single();

    if (dbError) {
      console.error("composio-callback: Database error:", dbError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to save connection. Please try again." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`composio-callback: Successfully saved integration:`, savedData);

    return new Response(
      JSON.stringify({
        success: true,
        toolkit,
        account: savedData,
        email: accountEmail,
        name: accountName,
        avatarUrl: accountAvatarUrl,
        status: "connected",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("composio-callback: Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
