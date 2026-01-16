import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v2";
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ContactInput {
  email: string;
  name?: string;
  monitorIncoming: boolean;
  monitorOutgoing: boolean;
}

interface TriggerResult {
  email: string;
  incomingTriggerId?: string;
  outgoingTriggerId?: string;
  success: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Request method:", req.method);
    const allHeaders = Object.fromEntries(req.headers.entries());
    console.log("Request headers:", JSON.stringify(allHeaders));
    
    // Get user from auth header - check both casings
    let authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    console.log("Auth header present:", !!authHeader, "value starts:", authHeader?.substring(0, 20));
    
    if (!authHeader) {
      console.error("Missing authorization header");
      // Return more helpful error with available headers
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No authorization header",
          debug: { headers: Object.keys(allHeaders) }
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    console.log("Auth result - user:", !!user, "userId:", user?.id, "error:", authError?.message, "errorCode:", authError?.code);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Not authenticated",
          debug: { authError: authError?.message, authCode: authError?.code }
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Gmail connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", user.id)
      .eq("integration_id", "gmail")
      .eq("status", "connected")
      .single();

    if (!integration?.composio_connection_id) {
      throw new Error("Gmail not connected");
    }

    const connectionId = integration.composio_connection_id;
    const body = await req.json();
    const { action } = body;

    console.log(`Email automation action: ${action}`);

    // Use service role for database operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "create") {
      const contacts: ContactInput[] = body.contacts;
      const results: TriggerResult[] = [];
      const webhookUrl = `${SUPABASE_URL}/functions/v1/email-automation-webhook`;

      for (const contact of contacts) {
        let incomingTriggerId: string | undefined;
        let outgoingTriggerId: string | undefined;

        try {
          // Create incoming email trigger if enabled
          if (contact.monitorIncoming) {
            console.log(`Creating incoming trigger for ${contact.email}`);
            const incomingResponse = await fetch(`${COMPOSIO_API_BASE}/triggers/enable/${connectionId}/GMAIL_NEW_GMAIL_MESSAGE`, {
              method: "POST",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                triggerConfig: {
                  interval: 5,
                  query: `from:${contact.email}`,
                  labelIds: "INBOX",
                  userId: "me",
                },
              }),
            });

            const incomingData = await incomingResponse.json();
            console.log("Incoming trigger response:", JSON.stringify(incomingData));

            if (incomingResponse.ok && incomingData.triggerId) {
              incomingTriggerId = incomingData.triggerId;
              
              // Set webhook for this trigger
              await fetch(`${COMPOSIO_API_BASE}/triggers/set_callback_url`, {
                method: "POST",
                headers: {
                  "x-api-key": COMPOSIO_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  callbackURL: webhookUrl,
                  triggerId: incomingTriggerId,
                }),
              });
            }
          }

          // Create outgoing email trigger if enabled
          if (contact.monitorOutgoing) {
            console.log(`Creating outgoing trigger for ${contact.email}`);
            const outgoingResponse = await fetch(`${COMPOSIO_API_BASE}/triggers/enable/${connectionId}/GMAIL_EMAIL_SENT_TRIGGER`, {
              method: "POST",
              headers: {
                "x-api-key": COMPOSIO_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                triggerConfig: {
                  interval: 5,
                  query: `to:${contact.email}`,
                  userId: "me",
                },
              }),
            });

            const outgoingData = await outgoingResponse.json();
            console.log("Outgoing trigger response:", JSON.stringify(outgoingData));

            if (outgoingResponse.ok && outgoingData.triggerId) {
              outgoingTriggerId = outgoingData.triggerId;
              
              // Set webhook for this trigger
              await fetch(`${COMPOSIO_API_BASE}/triggers/set_callback_url`, {
                method: "POST",
                headers: {
                  "x-api-key": COMPOSIO_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  callbackURL: webhookUrl,
                  triggerId: outgoingTriggerId,
                }),
              });
            }
          }

          // Save to database
          const { error: insertError } = await adminClient
            .from("email_automation_contacts")
            .upsert({
              user_id: user.id,
              email_address: contact.email,
              contact_name: contact.name,
              monitor_incoming: contact.monitorIncoming,
              monitor_outgoing: contact.monitorOutgoing,
              incoming_trigger_id: incomingTriggerId,
              outgoing_trigger_id: outgoingTriggerId,
              is_active: true,
            }, {
              onConflict: 'user_id,email_address',
            });

          if (insertError) {
            console.error("Database insert error:", insertError);
            throw insertError;
          }

          results.push({
            email: contact.email,
            incomingTriggerId,
            outgoingTriggerId,
            success: true,
          });
        } catch (error) {
          console.error(`Failed to create triggers for ${contact.email}:`, error);
          results.push({
            email: contact.email,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return new Response(
        JSON.stringify({
          success: successCount > 0,
          results,
          message: `Created triggers for ${successCount}/${contacts.length} contacts`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      const { contactId, incomingTriggerId, outgoingTriggerId } = body;

      try {
        // Disable triggers in Composio
        if (incomingTriggerId) {
          console.log(`Disabling incoming trigger: ${incomingTriggerId}`);
          await fetch(`${COMPOSIO_API_BASE}/triggers/disable/${incomingTriggerId}`, {
            method: "POST",
            headers: { "x-api-key": COMPOSIO_API_KEY },
          });
        }

        if (outgoingTriggerId) {
          console.log(`Disabling outgoing trigger: ${outgoingTriggerId}`);
          await fetch(`${COMPOSIO_API_BASE}/triggers/disable/${outgoingTriggerId}`, {
            method: "POST",
            headers: { "x-api-key": COMPOSIO_API_KEY },
          });
        }

        // Delete from database
        const { error: deleteError } = await adminClient
          .from("email_automation_contacts")
          .delete()
          .eq("id", contactId)
          .eq("user_id", user.id);

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Delete failed:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Delete failed" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Email automation error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Internal error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
