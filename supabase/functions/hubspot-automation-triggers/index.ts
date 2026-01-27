import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;

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
      // Create the HUBSPOT_CONTACT_CREATED_TRIGGER via Composio
      const webhookUrl = `${SUPABASE_URL}/functions/v1/hubspot-automation-webhook`;

      console.log(`[HubSpot Triggers] Creating trigger with webhook: ${webhookUrl}`);

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
            trigger_config: {},
            webhook_url: webhookUrl,
          }),
        }
      );

      const triggerText = await triggerResponse.text();
      console.log(`[HubSpot Triggers] Composio response: ${triggerResponse.status} - ${triggerText}`);

      if (!triggerResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to create trigger", details: triggerText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let triggerData;
      try {
        triggerData = JSON.parse(triggerText);
      } catch {
        triggerData = { id: null };
      }

      // Update config with trigger ID and set active
      const { error: updateError } = await supabaseClient
        .from("hubspot_automation_config")
        .update({
          is_active: true,
          trigger_id: triggerData?.id || triggerData?.data?.id || null,
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("[HubSpot Triggers] Failed to update config:", updateError);
      }

      return new Response(
        JSON.stringify({ success: true, triggerId: triggerData?.id }),
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
        // Disable the trigger
        const disableResponse = await fetch(
          `https://backend.composio.dev/api/v3/trigger_instances/${config.trigger_id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": COMPOSIO_API_KEY,
            },
            body: JSON.stringify({ enabled: false }),
          }
        );
        console.log(`[HubSpot Triggers] Disable response: ${disableResponse.status}`);
        await disableResponse.text();
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
