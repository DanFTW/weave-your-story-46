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

// Helper function to poll HubSpot contacts via Composio
async function pollHubSpotContacts(
  supabaseClient: any,
  userId: string,
  connectionId: string,
  composioApiKey: string
): Promise<{ newContacts: number; error?: string }> {
  try {
    console.log(`[HubSpot Poll] Fetching contacts for user ${userId}`);

    // Use Composio to list HubSpot contacts
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/HUBSPOT_LIST_CONTACTS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": composioApiKey,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            limit: 100,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HubSpot Poll] Composio error: ${response.status} - ${errorText}`);
      return { newContacts: 0, error: errorText };
    }

    const data = await response.json();
    console.log(`[HubSpot Poll] Response:`, JSON.stringify(data).slice(0, 500));

    // Extract contacts from response
    const contacts = data?.data?.results || data?.results || data?.data?.contacts || [];
    console.log(`[HubSpot Poll] Found ${contacts.length} contacts`);

    let newContactsCount = 0;

    for (const contact of contacts) {
      const hubspotContactId = contact.id || contact.vid?.toString();
      if (!hubspotContactId) continue;

      // Check if already processed
      const { data: existing } = await supabaseClient
        .from("hubspot_processed_contacts")
        .select("id")
        .eq("user_id", userId)
        .eq("hubspot_contact_id", hubspotContactId)
        .maybeSingle();

      if (existing) {
        continue; // Already processed
      }

      // Mark as processed
      await supabaseClient.from("hubspot_processed_contacts").insert({
        user_id: userId,
        hubspot_contact_id: hubspotContactId,
      });

      newContactsCount++;
      console.log(`[HubSpot Poll] New contact: ${hubspotContactId}`);

      // TODO: Create memory via LIAM API (similar to other automations)
      // For now, just track the count
    }

    // Update config with new count
    await supabaseClient
      .from("hubspot_automation_config")
      .update({
        last_polled_at: new Date().toISOString(),
        contacts_tracked: newContactsCount,
      })
      .eq("user_id", userId);

    return { newContacts: newContactsCount };
  } catch (err) {
    console.error(`[HubSpot Poll] Error:`, err);
    return { newContacts: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

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
      // Check if platform webhook credentials are available
      const hasWebhookCreds = HUBSPOT_APP_ID && HUBSPOT_DEVELOPER_API_KEY;

      if (hasWebhookCreds) {
        // WEBHOOK MODE: Use platform credentials for real-time triggers
        const webhookUrl = `${SUPABASE_URL}/functions/v1/hubspot-automation-webhook`;

        console.log(`[HubSpot Triggers] Attempting webhook trigger creation...`);
        console.log(`[HubSpot Triggers] Connection ID: ${connectionId}`);
        console.log(`[HubSpot Triggers] Webhook URL: ${webhookUrl}`);
        console.log(`[HubSpot Triggers] App ID: ${HUBSPOT_APP_ID}`);
        // Never log HUBSPOT_DEVELOPER_API_KEY

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

        // Update config with trigger ID and set active (webhook mode)
        const { error: updateError } = await supabaseClient
          .from("hubspot_automation_config")
          .update({
            is_active: true,
            trigger_id: triggerId,
            last_polled_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("[HubSpot Triggers] Failed to update config:", updateError);
        }

        return new Response(
          JSON.stringify({ success: true, mode: "webhook", triggerId }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // POLLING MODE: No webhook credentials, use polling fallback
        console.log(`[HubSpot Triggers] No webhook credentials, activating polling mode`);
        console.log(`[HubSpot Triggers] Connection ID: ${connectionId}`);

        // Just set active and let polling handle it
        const { error: updateError } = await supabaseClient
          .from("hubspot_automation_config")
          .update({
            is_active: true,
            trigger_id: null, // No trigger in polling mode
            last_polled_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("[HubSpot Triggers] Failed to update config:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to activate polling mode", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Do an initial poll to get existing contacts
        console.log(`[HubSpot Triggers] Running initial poll...`);
        const pollResult = await pollHubSpotContacts(supabaseClient, userId, connectionId, COMPOSIO_API_KEY);

        return new Response(
          JSON.stringify({ 
            success: true, 
            mode: "polling", 
            message: "Monitoring activated in polling mode",
            initialPoll: pollResult
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      // Fetch new contacts from HubSpot using the polling function
      console.log(`[HubSpot Triggers] Running manual poll for user ${userId}`);
      
      const pollResult = await pollHubSpotContacts(supabaseClient, userId, connectionId, COMPOSIO_API_KEY);

      return new Response(
        JSON.stringify({ success: true, newItems: pollResult.newContacts, error: pollResult.error }),
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
