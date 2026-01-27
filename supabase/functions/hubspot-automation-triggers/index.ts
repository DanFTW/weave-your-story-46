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
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

interface HubSpotContact {
  id: string;
  properties?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    jobtitle?: string;
    createdate?: string;
  };
}

// === CRYPTO UTILITIES FOR LIAM API ===

function removeLeadingZeros(bytes: Uint8Array): Uint8Array {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return bytes.slice(i);
}

function constructLength(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function toDER(signature: Uint8Array): string {
  const r = removeLeadingZeros(signature.slice(0, 32));
  const s = removeLeadingZeros(signature.slice(32, 64));

  const rPadded = r[0] >= 0x80 ? new Uint8Array([0, ...r]) : r;
  const sPadded = s[0] >= 0x80 ? new Uint8Array([0, ...s]) : s;

  const rLen = constructLength(rPadded.length);
  const sLen = constructLength(sPadded.length);

  const innerLength = 1 + rLen.length + rPadded.length + 1 + sLen.length + sPadded.length;
  const seqLen = constructLength(innerLength);

  const der = new Uint8Array(1 + seqLen.length + innerLength);
  let offset = 0;
  der[offset++] = 0x30;
  der.set(seqLen, offset);
  offset += seqLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset);
  offset += rLen.length;
  der.set(rPadded, offset);
  offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset);
  offset += sLen.length;
  der.set(sPadded, offset);

  return btoa(String.fromCharCode(...der));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body));
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );
  return toDER(new Uint8Array(signature));
}

// === LIAM MEMORY API ===

async function createMemory(apiKeys: any, content: string): Promise<boolean> {
  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body = { userKey: apiKeys.user_key, content };
    const signature = await signRequest(privateKey, body);

    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apiKey": apiKeys.api_key,
        "signature": signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[HubSpot] LIAM API error:", response.status, errorText);
    }

    return response.ok;
  } catch (error) {
    console.error("[HubSpot] Error creating memory:", error);
    return false;
  }
}

// Format contact as memory
function formatContactAsMemory(contact: HubSpotContact): string {
  const parts = ["HubSpot Contact Added", ""];

  const fullName = [contact.properties?.firstname, contact.properties?.lastname]
    .filter(Boolean)
    .join(" ");
  if (fullName) parts.push(`Name: ${fullName}`);
  if (contact.properties?.email) parts.push(`Email: ${contact.properties.email}`);
  if (contact.properties?.company) parts.push(`Company: ${contact.properties.company}`);
  if (contact.properties?.jobtitle) parts.push(`Title: ${contact.properties.jobtitle}`);
  if (contact.properties?.phone) parts.push(`Phone: ${contact.properties.phone}`);

  const createdDate = contact.properties?.createdate
    ? new Date(contact.properties.createdate).toLocaleDateString()
    : new Date().toLocaleDateString();
  parts.push(`Added: ${createdDate}`);

  parts.push("");
  parts.push("A new contact was added to your HubSpot CRM.");

  return parts.join("\n");
}

// === HUBSPOT API HELPERS ===

// Get OAuth access token from Composio connected account
async function getHubSpotAccessToken(connectionId: string): Promise<string | null> {
  try {
    console.log("[HubSpot] Fetching OAuth token for connection:", connectionId);

    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        method: "GET",
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error("[HubSpot] Failed to fetch connected account:", response.status);
      return null;
    }

    const data = await response.json();

    // Try different paths where the token might be stored
    const accessToken =
      data?.data?.connection_params?.access_token ||
      data?.data?.access_token ||
      data?.connection_params?.access_token ||
      data?.access_token ||
      null;

    if (!accessToken) {
      console.error("[HubSpot] No access token found in Composio response. Keys:", Object.keys(data?.data || data));
    }

    return accessToken;
  } catch (error) {
    console.error("[HubSpot] Error fetching access token:", error);
    return null;
  }
}

// Fetch contacts directly from HubSpot CRM API
async function fetchHubSpotContacts(connectionId: string): Promise<HubSpotContact[]> {
  console.log("[HubSpot] Fetching contacts via direct API...");

  try {
    const accessToken = await getHubSpotAccessToken(connectionId);

    if (!accessToken) {
      console.error("[HubSpot] No access token available for HubSpot API");
      return [];
    }

    console.log("[HubSpot] Got access token, calling HubSpot CRM API...");

    const response = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,company,jobtitle,createdate",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = await response.text();
    console.log("[HubSpot] CRM API response status:", response.status);

    if (!response.ok) {
      console.error("[HubSpot] CRM API error:", response.status, responseText.slice(0, 500));
      return [];
    }

    const data = JSON.parse(responseText);
    const contacts = data.results || [];

    console.log(`[HubSpot] Found ${contacts.length} contacts`);
    return contacts;
  } catch (error) {
    console.error("[HubSpot] Error fetching contacts:", error);
    return [];
  }
}

// === POLLING LOGIC ===

async function pollHubSpotContacts(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newContacts: number; error?: string }> {
  try {
    console.log(`[HubSpot Poll] Processing user ${userId}`);

    // Get user's API keys for LIAM
    const { data: apiKeys } = await supabaseClient
      .from("user_api_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!apiKeys) {
      console.log(`[HubSpot Poll] User ${userId}: API keys not configured, skipping memory creation`);
    }

    // Fetch contacts from HubSpot CRM API
    const contacts = await fetchHubSpotContacts(connectionId);

    if (contacts.length === 0) {
      console.log(`[HubSpot Poll] No contacts found for user ${userId}`);
      return { newContacts: 0 };
    }

    // Get current config for counter accumulation
    const { data: config } = await supabaseClient
      .from("hubspot_automation_config")
      .select("contacts_tracked")
      .eq("user_id", userId)
      .maybeSingle();

    const currentCount = config?.contacts_tracked || 0;
    let newContactsCount = 0;

    for (const contact of contacts) {
      const hubspotContactId = contact.id;
      if (!hubspotContactId) continue;

      // Check if already processed (deduplication)
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

      const fullName = [contact.properties?.firstname, contact.properties?.lastname]
        .filter(Boolean)
        .join(" ") || contact.properties?.email || hubspotContactId;
      console.log(`[HubSpot Poll] New contact: ${fullName}`);

      // Create memory via LIAM API if API keys are configured
      if (apiKeys) {
        const memoryContent = formatContactAsMemory(contact);
        const success = await createMemory(apiKeys, memoryContent);
        if (success) {
          console.log(`[HubSpot Poll] Created memory for contact: ${fullName}`);
        } else {
          console.error(`[HubSpot Poll] Failed to create memory for: ${fullName}`);
        }
      }
    }

    // Update config with accumulated count
    await supabaseClient
      .from("hubspot_automation_config")
      .update({
        last_polled_at: new Date().toISOString(),
        contacts_tracked: currentCount + newContactsCount,
      })
      .eq("user_id", userId);

    console.log(`[HubSpot Poll] Processed ${newContactsCount} new contacts for user ${userId}`);
    return { newContacts: newContactsCount };
  } catch (err) {
    console.error(`[HubSpot Poll] Error:`, err);
    return { newContacts: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// === MAIN HANDLER ===

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
        // Never log secrets

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
              composioStatus: triggerResponse.status,
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
        const pollResult = await pollHubSpotContacts(supabaseClient, userId, connectionId);

        return new Response(
          JSON.stringify({
            success: true,
            mode: "polling",
            message: "Monitoring activated in polling mode",
            initialPoll: pollResult,
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

      const pollResult = await pollHubSpotContacts(supabaseClient, userId, connectionId);

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
