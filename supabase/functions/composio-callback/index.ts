import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    console.log(`Composio data: ${responseText}`);

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

    // Extract email from response - try multiple possible locations
    const connectionData = accountData.connectionData || accountData.connection_params || accountData.data || {};
    const accountEmail = connectionData.user_email || 
                         connectionData.email || 
                         accountData.user_email ||
                         null;

    console.log(`Account email: ${accountEmail}`);

    // Upsert to user_integrations table (using existing table structure)
    const { data, error } = await supabase
      .from("user_integrations")
      .upsert({
        user_id: userId,
        integration_id: toolkit?.toLowerCase() || "gmail",
        composio_connection_id: connectionId,
        status: "connected",
        account_email: accountEmail,
        account_name: connectionData.name || connectionData.display_name || null,
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

    console.log(`Saved integration:`, data);

    return new Response(
      JSON.stringify({
        success: true,
        account: data,
        email: accountEmail,
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
