import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const HUBSPOT_APP_ID = Deno.env.get("HUBSPOT_APP_ID");
const HUBSPOT_DEVELOPER_API_KEY = Deno.env.get("HUBSPOT_DEVELOPER_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseAuth = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const { action } = await req.json();

    console.log(`[HubSpot Triggers] Action: ${action}, User: ${userId}`);

    // Get user's HubSpot connection
    const { data: integration, error: integrationError } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "hubspot")
      .eq("status", "connected")
      .maybeSingle();

    if (integrationError || !integration?.composio_connection_id) {
      return new Response(
        JSON.stringify({ error: "HubSpot not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connectionId = integration.composio_connection_id;

    if (action === "activate") {
      // Validate required HubSpot credentials from secrets
      if (!HUBSPOT_APP_ID || !HUBSPOT_DEVELOPER_API_KEY) {
        console.error("[HubSpot Triggers] Missing required secrets: HUBSPOT_APP_ID or HUBSPOT_DEVELOPER_API_KEY");
        return new Response(
          JSON.stringify({
            error: "Missing HubSpot trigger config",
            details: "HUBSPOT_APP_ID and HUBSPOT_DEVELOPER_API_KEY are required to create HUBSPOT_CONTACT_CREATED_TRIGGER.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const webhookUrl = `${SUPABASE_URL}/functions/v1/hubspot-automation-webhook`;

      console.log(`[HubSpot Triggers] Attempting to create trigger...`);
      console.log(`[HubSpot Triggers] Connection ID: ${connectionId}`);
      console.log(`[HubSpot Triggers] Webhook URL: ${webhookUrl}`);
      console.log(`[HubSpot Triggers] App ID: ${HUBSPOT_APP_ID}`);
      // Never log HUBSPOT_DEVELOPER_API_KEY

      // Create the trigger with required config
      const triggerResponse = await fetch(
        "https://backend.composio.dev/api/v3/trigger_instances/HUBSPOT_CONTACT_CREATED_TRIGGER/upsert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            trigger_config: {
              app_id: HUBSPOT_APP_ID,
              developer_api_key: HUBSPOT_DEVELOPER_API_KEY,
            },
            webhook_url: webhookUrl,
          }),
        }
      );

      const triggerText = await triggerResponse.text();
      console.log(`[HubSpot Triggers] Composio response status: ${triggerResponse.status}`);
      console.log(`[HubSpot Triggers] Composio response body: ${triggerText}`);

      if (!triggerResponse.ok) {
        // Surface real Composio error with actual status code
        let errorDetails = triggerText;
        try {
          const errorJson = JSON.parse(triggerText);
          console.error(`[HubSpot Triggers] Parsed error:`, JSON.stringify(errorJson, null, 2));
          if (errorJson.errors || errorJson.details || errorJson.message) {
            errorDetails = JSON.stringify(errorJson.errors || errorJson.details || errorJson.message);
          }
        } catch {
          // Keep raw text as error details
        }
        
        return new Response(
          JSON.stringify({ 
            error: "Failed to create trigger", 
            details: errorDetails,
            composioStatus: triggerResponse.status
          }),
          { status: triggerResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse successful response
      let triggerData;
      try {
        triggerData = JSON.parse(triggerText);
      } catch {
        triggerData = {};
      }

      // Extract trigger_id - Composio v3 returns it at root level
      const triggerId = triggerData?.trigger_id || triggerData?.id || null;
      console.log(`[HubSpot Triggers] Created trigger ID: ${triggerId}`);

      // Update config with trigger ID and set active
      const { error: updateError } = await supabaseClient
        .from("hubspot_automation_config")
        .update({
          is_active: true,
          trigger_id: triggerId,
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[HubSpot Triggers] Failed to update config:", updateError);
      }

      return new Response(
        JSON.stringify({ success: true, triggerId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate") {
      // Get the trigger ID from config
      const { data: config } = await supabaseClient
        .from("hubspot_automation_config")
        .select("trigger_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.trigger_id) {
        // Disable the trigger using correct endpoint
        const disableResponse = await fetch(
          `https://backend.composio.dev/api/v3/trigger_instances/manage/${config.trigger_id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify({ enabled: false }),
          }
        );
        const disableText = await disableResponse.text();
        console.log(`[HubSpot Triggers] Disable response: ${disableResponse.status} - ${disableText}`);
      }

      // Update config
      await supabaseClient
        .from("hubspot_automation_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "manual-poll") {
      // For manual poll, we'd need to fetch contacts from HubSpot
      // This is a simplified version - the webhook handles the actual contact creation
      
      // Update last polled timestamp
      await supabaseClient
        .from("hubspot_automation_config")
        .update({ last_polled_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, newItems: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[HubSpot Triggers] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
