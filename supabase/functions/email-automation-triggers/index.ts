import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Composio v3 API base
const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";
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

interface TriggerStatus {
  triggerId: string;
  status: string;
  enabled: boolean;
  lastPolled?: string;
  config?: Record<string, unknown>;
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

    // Get user's Gmail connection (connected_account_id in v3 terminology)
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

    const connectedAccountId = integration.composio_connection_id;
    console.log("Using connected_account_id:", connectedAccountId);
    
    const body = await req.json();
    const { action } = body;

    console.log(`Email automation action: ${action}`);

    // Use service role for database operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ==================== STATUS ACTION ====================
    // Get trigger status from Composio - use active list endpoint
    if (action === "status") {
      const { triggerIds } = body;
      
      if (!triggerIds || !Array.isArray(triggerIds) || triggerIds.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No trigger IDs provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Fetch all active triggers for this connected account
        console.log(`Fetching active triggers for connection: ${connectedAccountId}`);
        const response = await fetch(
          `${COMPOSIO_API_BASE}/trigger_instances/active?connectedAccountId=${connectedAccountId}`,
          {
            method: "GET",
            headers: { "x-api-key": COMPOSIO_API_KEY },
          }
        );

        const responseText = await response.text();
        console.log(`Active triggers response:`, response.status, responseText.substring(0, 500));

        if (!response.ok) {
          // Fallback: try to get trigger details individually
          console.log("Active endpoint failed, trying individual lookups...");
          const statuses: TriggerStatus[] = [];
          
          for (const triggerId of triggerIds) {
            if (!triggerId) continue;
            
            // Try the v2-style endpoint as fallback
            try {
              const detailResponse = await fetch(
                `https://backend.composio.dev/api/v1/triggers/instance/${triggerId}`,
                {
                  method: "GET",
                  headers: { "x-api-key": COMPOSIO_API_KEY },
                }
              );
              
              const detailText = await detailResponse.text();
              console.log(`v1 trigger detail for ${triggerId}:`, detailResponse.status, detailText.substring(0, 200));
              
              if (detailResponse.ok) {
                const data = JSON.parse(detailText);
                statuses.push({
                  triggerId,
                  status: data.status || "active",
                  enabled: data.disabled !== true,
                  lastPolled: data.lastPollTime || data.updatedAt,
                  config: data.triggerConfig || data.config,
                });
              } else {
                statuses.push({
                  triggerId,
                  status: "not_found",
                  enabled: false,
                  error: `Trigger not found (HTTP ${detailResponse.status})`,
                });
              }
            } catch (err) {
              statuses.push({
                triggerId,
                status: "error",
                enabled: false,
                error: err instanceof Error ? err.message : "Unknown error",
              });
            }
          }
          
          return new Response(
            JSON.stringify({ success: true, statuses }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Parse the active triggers list
        const data = JSON.parse(responseText);
        const activeTriggers = data.triggers || data.items || data || [];
        
        // Map requested trigger IDs to their status
        const statuses: TriggerStatus[] = triggerIds.map((triggerId: string) => {
          if (!triggerId) {
            return { triggerId: "", status: "invalid", enabled: false };
          }
          
          const found = activeTriggers.find((t: any) => 
            t.trigger_id === triggerId || 
            t.triggerId === triggerId || 
            t.id === triggerId
          );
          
          if (found) {
            return {
              triggerId,
              status: found.status || "active",
              enabled: found.enabled !== false && found.disabled !== true,
              lastPolled: found.last_polled_at || found.lastPollTime || found.updatedAt,
              config: found.trigger_config || found.triggerConfig,
            };
          } else {
            return {
              triggerId,
              status: "not_found",
              enabled: false,
              error: "Trigger not in active list",
            };
          }
        });

        return new Response(
          JSON.stringify({ success: true, statuses, totalActive: activeTriggers.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Failed to check trigger status:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to check status",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== LOGS ACTION ====================
    // Get trigger logs from Composio
    if (action === "logs") {
      try {
        console.log(`Fetching trigger logs for connection: ${connectedAccountId}`);
        
        // Try to get logs - Composio v3 API endpoint
        const response = await fetch(
          `${COMPOSIO_API_BASE}/triggers/logs?connectionId=${connectedAccountId}&limit=50`,
          {
            method: "GET",
            headers: { "x-api-key": COMPOSIO_API_KEY },
          }
        );

        const responseText = await response.text();
        console.log(`Logs response:`, response.status, responseText.substring(0, 500));

        if (response.ok) {
          const data = JSON.parse(responseText);
          return new Response(
            JSON.stringify({ 
              success: true, 
              logs: data.logs || data.items || data,
              total: data.total || (data.logs || data.items || []).length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to fetch logs: HTTP ${response.status}`,
              details: responseText,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to fetch logs",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== ENABLE ACTION ====================
    // Re-enable a trigger
    if (action === "enable") {
      const { triggerId } = body;
      
      if (!triggerId) {
        return new Response(
          JSON.stringify({ success: false, error: "No trigger ID provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        console.log(`Enabling trigger: ${triggerId}`);
        const response = await fetch(
          `${COMPOSIO_API_BASE}/trigger_instances/manage/${triggerId}`,
          {
            method: "PATCH",
            headers: { 
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ enabled: true }),
          }
        );

        const responseText = await response.text();
        console.log(`Enable response:`, response.status, responseText);

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true, message: "Trigger enabled" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to enable: HTTP ${response.status}`,
              details: responseText,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (error) {
        console.error("Failed to enable trigger:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error instanceof Error ? error.message : "Failed to enable trigger",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== CREATE ACTION ====================
    if (action === "create") {
      const contacts: ContactInput[] = body.contacts;
      const results: TriggerResult[] = [];
      const webhookUrl = `${SUPABASE_URL}/functions/v1/email-automation-webhook`;
      console.log("Webhook URL:", webhookUrl);

      // Set global Composio project callback URL so trigger events are delivered
      try {
        console.log("Setting global Composio callback URL...");
        const cbResponse = await fetch(
          `https://backend.composio.dev/api/v1/triggers/set_callback_url`,
          {
            method: "POST",
            headers: {
              "x-api-key": COMPOSIO_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ callbackURL: webhookUrl }),
          }
        );
        const cbText = await cbResponse.text();
        console.log("Set callback URL response:", cbResponse.status, cbText);
      } catch (cbErr) {
        console.error("Failed to set callback URL (non-fatal):", cbErr);
      }

      for (const contact of contacts) {
        let incomingTriggerId: string | undefined;
        let outgoingTriggerId: string | undefined;

        try {
          // Create incoming email trigger if enabled using v3 API
          if (contact.monitorIncoming) {
            console.log(`Creating incoming trigger for ${contact.email} using v3 API`);
            
            // v3 API: POST /trigger_instances/{slug}/upsert
            const incomingResponse = await fetch(
              `${COMPOSIO_API_BASE}/trigger_instances/GMAIL_NEW_GMAIL_MESSAGE/upsert`,
              {
                method: "POST",
                headers: {
                  "x-api-key": COMPOSIO_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  connected_account_id: connectedAccountId,
                  trigger_config: {
                    interval: 1,
                    query: `from:${contact.email}`,
                    labelIds: "INBOX",
                    userId: "me",
                  },
                }),
              }
            );

            const incomingText = await incomingResponse.text();
            console.log("Incoming trigger response status:", incomingResponse.status);
            console.log("Incoming trigger response:", incomingText);

            if (incomingResponse.ok) {
              const incomingData = JSON.parse(incomingText);
              // v3 returns trigger_id
              incomingTriggerId = incomingData.trigger_id || incomingData.trigger_instance_id || incomingData.id;
              console.log("Incoming trigger ID:", incomingTriggerId);
            } else {
              console.error("Failed to create incoming trigger:", incomingText);
            }
          }

          // Create outgoing email trigger if enabled using v3 API
          if (contact.monitorOutgoing) {
            console.log(`Creating outgoing trigger for ${contact.email} using v3 API`);
            
            const outgoingResponse = await fetch(
              `${COMPOSIO_API_BASE}/trigger_instances/GMAIL_EMAIL_SENT_TRIGGER/upsert`,
              {
                method: "POST",
                headers: {
                  "x-api-key": COMPOSIO_API_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  connected_account_id: connectedAccountId,
                  trigger_config: {
                    interval: 1,
                    query: `to:${contact.email}`,
                    userId: "me",
                  },
                }),
              }
            );

            const outgoingText = await outgoingResponse.text();
            console.log("Outgoing trigger response status:", outgoingResponse.status);
            console.log("Outgoing trigger response:", outgoingText);

            if (outgoingResponse.ok) {
              const outgoingData = JSON.parse(outgoingText);
              // v3 returns trigger_id
              outgoingTriggerId = outgoingData.trigger_id || outgoingData.trigger_instance_id || outgoingData.id;
              console.log("Outgoing trigger ID:", outgoingTriggerId);
            } else {
              console.error("Failed to create outgoing trigger:", outgoingText);
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
            success: !!(incomingTriggerId || outgoingTriggerId),
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

    // ==================== BACKFILL ACTION ====================
    // Fetch recent emails from Gmail for monitored contacts and populate history
    if (action === "backfill") {
      try {
        console.log("Starting email backfill for user:", user.id);

        // Get all active monitored contacts
        const { data: activeContacts, error: contactsError } = await adminClient
          .from("email_automation_contacts")
          .select("email_address, monitor_incoming, monitor_outgoing")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (contactsError || !activeContacts || activeContacts.length === 0) {
          return new Response(
            JSON.stringify({ success: true, message: "No active contacts", inserted: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get existing email_message_ids to dedupe
        const { data: existingEmails } = await adminClient
          .from("email_automation_processed_emails")
          .select("email_message_id")
          .eq("user_id", user.id)
          .not("email_message_id", "is", null);

        const existingIds = new Set((existingEmails || []).map(e => e.email_message_id));
        console.log(`Existing processed emails: ${existingIds.size}`);

        let totalInserted = 0;

        for (const contact of activeContacts) {
          const emailAddr = contact.email_address;
          console.log(`Backfilling emails for: ${emailAddr}`);

          // Fetch emails from/to this contact via Composio GMAIL_FETCH_EMAILS
          const query = `from:${emailAddr} OR to:${emailAddr}`;
          
          try {
            const searchResponse = await fetch(
              "https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": COMPOSIO_API_KEY,
                },
                body: JSON.stringify({
                  connected_account_id: connectedAccountId,
                  arguments: {
                    query,
                    max_results: 30,
                  },
                }),
              }
            );

            if (!searchResponse.ok) {
              const errText = await searchResponse.text();
              console.error(`Gmail fetch failed for ${emailAddr}:`, errText);
              continue;
            }

            const searchData = await searchResponse.json();
            const responseData = searchData.data || searchData;
            const messages = responseData?.messages || responseData?.results || responseData?.threadsList || responseData?.emails || [];
            console.log(`Found ${messages.length} messages for ${emailAddr}`);

            for (const message of messages) {
              const messageId = message.id || message.messageId || message.message_id;
              if (!messageId || existingIds.has(messageId)) continue;

              // Determine direction
              const from = message.from || message.From || message.sender || "";
              const to = message.to || message.To || message.recipient || "";
              const fromLower = from.toLowerCase();
              const isIncoming = fromLower.includes(emailAddr.toLowerCase());
              const direction = isIncoming ? "incoming" : "outgoing";

              // Extract subject
              let subject = message.subject || message.Subject || "(No subject)";
              if (typeof message.snippet === "object" && message.snippet?.subject) {
                subject = message.snippet.subject;
              }

              // Extract snippet text
              let snippetText = "";
              if (typeof message.snippet === "object" && message.snippet?.body) {
                snippetText = message.snippet.body;
              } else if (typeof message.snippet === "string") {
                snippetText = message.snippet;
              } else if (message.messageText) {
                snippetText = message.messageText;
              } else if (message.preview) {
                snippetText = message.preview;
              }

              const dateStr = message.date || message.Date || message.internalDate || null;

              const { error: insertErr } = await adminClient
                .from("email_automation_processed_emails")
                .insert({
                  user_id: user.id,
                  contact_email: emailAddr,
                  sender: from || null,
                  subject: subject || null,
                  snippet: snippetText ? snippetText.substring(0, 200) : null,
                  direction,
                  email_message_id: messageId,
                  processed_at: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
                });

              if (!insertErr) {
                existingIds.add(messageId);
                totalInserted++;
              }
            }
          } catch (fetchErr) {
            console.error(`Error fetching emails for ${emailAddr}:`, fetchErr);
          }
        }

        console.log(`Backfill complete: inserted ${totalInserted} new records`);
        return new Response(
          JSON.stringify({ success: true, inserted: totalInserted }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error("Backfill error:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Backfill failed",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==================== DELETE ACTION ====================
    if (action === "delete") {
      const { contactId, incomingTriggerId, outgoingTriggerId } = body;

      try {
        // Delete triggers in Composio using v3 API
        if (incomingTriggerId) {
          console.log(`Deleting incoming trigger: ${incomingTriggerId} using v3 API`);
          const deleteResponse = await fetch(
            `${COMPOSIO_API_BASE}/trigger_instances/manage/${incomingTriggerId}`,
            {
              method: "DELETE",
              headers: { "x-api-key": COMPOSIO_API_KEY },
            }
          );
          console.log("Delete incoming response:", deleteResponse.status, await deleteResponse.text());
        }

        if (outgoingTriggerId) {
          console.log(`Deleting outgoing trigger: ${outgoingTriggerId} using v3 API`);
          const deleteResponse = await fetch(
            `${COMPOSIO_API_BASE}/trigger_instances/manage/${outgoingTriggerId}`,
            {
              method: "DELETE",
              headers: { "x-api-key": COMPOSIO_API_KEY },
            }
          );
          console.log("Delete outgoing response:", deleteResponse.status, await deleteResponse.text());
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