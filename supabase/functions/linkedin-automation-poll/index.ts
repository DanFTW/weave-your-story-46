import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

interface LinkedInConnection {
  id: string;
  urn?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  company?: string;
  location?: string;
  profilePicture?: string;
  connectedAt?: string;
}

interface AutomationConfig {
  user_id: string;
  is_active: boolean;
  monitor_new_connections: boolean;
  connections_tracked: number;
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
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
    .replace(/-----END EC PRIVATE KEY-----/g, "")
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

// === COMPOSIO API HELPERS ===

async function getConnectedAccountId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "linkedin")
    .eq("status", "connected")
    .maybeSingle();

  return data?.composio_connection_id || null;
}

// Fetch LinkedIn connections via Composio
async function fetchLinkedInConnections(connectionId: string): Promise<LinkedInConnection[]> {
  console.log("Fetching LinkedIn connections...");
  
  try {
    const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/LINKEDIN_GET_MY_CONNECTIONS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {},
      }),
    });

    const responseText = await response.text();
    console.log("LinkedIn connections response status:", response.status);

    if (!response.ok) {
      console.error("Composio API error fetching connections:", response.status, responseText);
      return [];
    }

    const data = JSON.parse(responseText);
    const responseData = data.data || data;
    
    // Parse connections from response
    let connections = responseData?.response_data?.elements ||
                      responseData?.response_data?.connections ||
                      responseData?.elements ||
                      responseData?.connections ||
                      responseData?.data ||
                      [];

    if (!Array.isArray(connections)) {
      console.log("Connections data is not an array, raw:", JSON.stringify(responseData).slice(0, 500));
      return [];
    }

    console.log(`Found ${connections.length} LinkedIn connections`);

    return connections.map((conn: any) => {
      // Handle different API response formats
      const profile = conn.miniProfile || conn.profile || conn;
      return {
        id: conn.urn || conn.entityUrn || conn.id || profile.entityUrn || `connection_${Date.now()}`,
        urn: conn.urn || conn.entityUrn || profile.entityUrn,
        firstName: profile.firstName || conn.firstName,
        lastName: profile.lastName || conn.lastName,
        headline: profile.headline || profile.occupation || conn.headline,
        company: profile.company?.name || profile.companyName || conn.company,
        location: profile.locationName || profile.location || conn.location,
        profilePicture: profile.picture?.displayImageUrl || profile.profilePicture || conn.profilePicture,
        connectedAt: conn.createdAt || conn.connectedAt,
      };
    });
  } catch (error) {
    console.error("Error fetching LinkedIn connections:", error);
    return [];
  }
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
      console.error("LIAM API error:", response.status, errorText);
    }

    return response.ok;
  } catch (error) {
    console.error("Error creating memory:", error);
    return false;
  }
}

// Format connection as memory
function formatConnectionAsMemory(connection: LinkedInConnection): string {
  const parts = [
    "🔗 New LinkedIn Connection",
    "",
  ];

  const fullName = [connection.firstName, connection.lastName].filter(Boolean).join(" ");
  if (fullName) {
    parts.push(`Name: ${fullName}`);
  }

  if (connection.headline) {
    parts.push(`Headline: ${connection.headline}`);
  }

  if (connection.company) {
    parts.push(`Company: ${connection.company}`);
  }

  if (connection.location) {
    parts.push(`Location: ${connection.location}`);
  }

  if (connection.connectedAt) {
    const connectedDate = new Date(connection.connectedAt).toLocaleDateString();
    parts.push(`Connected on: ${connectedDate}`);
  }

  parts.push("");
  parts.push("Your professional network just grew.");

  return parts.join("\n");
}

// === SHARED POLLING LOGIC ===

async function processUserLinkedIn(
  supabase: any,
  userId: string,
  config: AutomationConfig
): Promise<{ newItems: number; connectionsTracked: number }> {
  // Get connected account
  const connectedAccountId = await getConnectedAccountId(supabase, userId);
  if (!connectedAccountId) {
    console.log(`User ${userId}: LinkedIn not connected, skipping`);
    return { newItems: 0, connectionsTracked: config.connections_tracked };
  }

  // Get API keys
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.log(`User ${userId}: API keys not configured, skipping`);
    return { newItems: 0, connectionsTracked: config.connections_tracked };
  }

  let newItems = 0;
  let connectionsTracked = config.connections_tracked || 0;

  // Fetch recent connections
  if (config.monitor_new_connections) {
    const connections = await fetchLinkedInConnections(connectedAccountId);

    for (const connection of connections) {
      // Generate dedup key from connection URN or ID
      const dedupKey = `linkedin_connection_${connection.urn || connection.id}`;

      // Check if connection already processed
      const { data: existingConnection } = await supabase
        .from("linkedin_processed_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("linkedin_connection_id", dedupKey)
        .maybeSingle();

      if (!existingConnection) {
        // Create memory for new connection
        const memoryContent = formatConnectionAsMemory(connection);
        
        const success = await createMemory(apiKeys, memoryContent);
        if (success) {
          // Record as processed
          await supabase
            .from("linkedin_processed_connections")
            .insert({
              user_id: userId,
              linkedin_connection_id: dedupKey,
            });
          connectionsTracked++;
          newItems++;
          console.log(`Created memory for connection: ${connection.firstName} ${connection.lastName}`);
        }
      }
    }
  }

  // Update stats
  await supabase
    .from("linkedin_automation_config")
    .update({
      last_polled_at: new Date().toISOString(),
      connections_tracked: connectionsTracked,
    })
    .eq("user_id", userId);

  return { newItems, connectionsTracked };
}

// === MAIN HANDLER ===

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse body first to check action
    const body = await req.json();
    const { action } = body;

    // Handle cron-poll action (no user auth required, uses cron secret)
    if (action === "cron-poll") {
      const cronSecret = req.headers.get("x-cron-secret");
      if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
        console.error("Cron poll: Invalid or missing cron secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Cron poll: Starting automatic LinkedIn check for all active users");

      // Get all active automation configs
      const { data: activeConfigs, error: configError } = await supabase
        .from("linkedin_automation_config")
        .select("*")
        .eq("is_active", true);

      if (configError) {
        console.error("Cron poll: Error fetching configs:", configError);
        return new Response(JSON.stringify({ error: "Failed to fetch configs" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!activeConfigs || activeConfigs.length === 0) {
        console.log("Cron poll: No active users to process");
        return new Response(JSON.stringify({ success: true, processed: 0, message: "No active users" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Cron poll: Processing ${activeConfigs.length} active user(s)`);

      let totalProcessed = 0;
      let totalNewItems = 0;
      const errors: string[] = [];

      for (const config of activeConfigs) {
        try {
          console.log(`Cron poll: Processing user ${config.user_id}`);
          const result = await processUserLinkedIn(supabase, config.user_id, config);
          totalProcessed++;
          totalNewItems += result.newItems;
          console.log(`Cron poll: User ${config.user_id} - ${result.newItems} new items`);
        } catch (userError) {
          console.error(`Cron poll: Error for user ${config.user_id}:`, userError);
          errors.push(`User ${config.user_id}: ${userError}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: totalProcessed,
          newItems: totalNewItems,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For user-initiated actions, require JWT auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${user.id} requested action: ${action}`);

    // Handle different actions
    switch (action) {
      case "activate": {
        await supabase
          .from("linkedin_automation_config")
          .update({ is_active: true })
          .eq("user_id", user.id);

        return new Response(
          JSON.stringify({ success: true, message: "LinkedIn monitoring activated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "deactivate": {
        await supabase
          .from("linkedin_automation_config")
          .update({ is_active: false })
          .eq("user_id", user.id);

        return new Response(
          JSON.stringify({ success: true, message: "LinkedIn monitoring deactivated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "manual-poll": {
        // Get user's config
        const { data: config } = await supabase
          .from("linkedin_automation_config")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!config) {
          return new Response(
            JSON.stringify({ error: "Config not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const result = await processUserLinkedIn(supabase, user.id, config);

        return new Response(
          JSON.stringify({ success: true, newItems: result.newItems, connectionsTracked: result.connectionsTracked }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "stats": {
        const { data: config } = await supabase
          .from("linkedin_automation_config")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            connectionsTracked: config?.connections_tracked ?? 0,
            lastPolledAt: config?.last_polled_at,
            isActive: config?.is_active ?? false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("LinkedIn automation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
