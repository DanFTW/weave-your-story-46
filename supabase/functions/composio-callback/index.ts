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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!COMPOSIO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { connectionId, userId, toolkit } = await req.json();

    console.log(`Processing callback for connectionId: ${connectionId}`);
    console.log(`User ID: ${userId}, Toolkit: ${toolkit}`);

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: "Missing connectionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch connection details from Composio
    const composioResponse = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        headers: { "x-api-key": COMPOSIO_API_KEY },
      }
    );

    const responseText = await composioResponse.text();
    console.log(`Composio status response: ${composioResponse.status}`);

    if (!composioResponse.ok) {
      console.error("Failed to fetch connection:", composioResponse.status, responseText);
      throw new Error("Failed to fetch connection details");
    }

    const accountData = JSON.parse(responseText);
    const status = accountData.status || "UNKNOWN";
    
    console.log(`Connection status: ${status}`);

    if (status !== "ACTIVE" && status !== "active") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status, 
          message: "Connection not active yet" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract user info from the OAuth data
    // For Google OAuth, the id_token contains user profile information
    const data = accountData.data || {};
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
        console.log(`Extracted from id_token - email: ${accountEmail}, name: ${accountName}, picture: ${accountAvatarUrl}`);
      }
    }

    // Fallback to other possible locations
    if (!accountEmail) {
      const connectionData = accountData.connectionData || accountData.connection_params || {};
      accountEmail = connectionData.user_email || connectionData.email || accountData.user_email || null;
      accountName = connectionData.name || connectionData.display_name || null;
    }

    console.log(`Final account info - email: ${accountEmail}, name: ${accountName}, avatar: ${accountAvatarUrl}`);

    // Upsert to user_integrations table
    const { data: savedData, error } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: userId,
        integration_id: toolkit?.toLowerCase() || "gmail",
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

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log(`Saved integration:`, savedData);

    return new Response(
      JSON.stringify({
        success: true,
        account: savedData,
        email: accountEmail,
        name: accountName,
        avatarUrl: accountAvatarUrl,
        status: "connected",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in composio-callback:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
