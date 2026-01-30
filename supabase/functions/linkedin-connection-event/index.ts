import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://yatadupadielakuenxui.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LIAM_API_KEY = Deno.env.get("LIAM_API_KEY") || "";
const LIAM_PRIVATE_KEY = Deno.env.get("LIAM_PRIVATE_KEY") || "";

interface ConnectionEventPayload {
  source: string;
  event: string;
  profile_url: string;
  public_identifier: string;
  full_name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  avatar_url: string | null;
  occurred_at: string;
}

/**
 * Normalize LinkedIn profile URL to canonical form
 */
function normalizeProfileUrl(url: string): string {
  if (!url) return "";
  
  // Extract the public identifier
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
  if (match) {
    return `https://www.linkedin.com/in/${match[1].toLowerCase()}/`;
  }
  
  // Remove tracking params and normalize
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Generate dedupe key for a connection
 */
function generateDedupeKey(userId: string, profileUrl: string): string {
  return `linkedin:contact:${userId}:${normalizeProfileUrl(profileUrl)}`;
}

/**
 * Sign data with ECDSA for LIAM API
 */
async function signWithECDSA(data: string, privateKeyBase64: string): Promise<string> {
  const privateKeyDer = Uint8Array.from(atob(privateKeyBase64), (c) => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(data)
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Create memory via LIAM API
 */
async function createMemory(
  userKey: string,
  payload: ConnectionEventPayload,
  dedupeKey: string
): Promise<{ success: boolean; memoryId?: string; error?: string }> {
  const apiUrl = "https://web.askbuddy.ai/devspacexdb/api/memory/create";
  
  // Build memory content
  const lines: string[] = [];
  if (payload.full_name) lines.push(`Name: ${payload.full_name}`);
  if (payload.headline) lines.push(`Title: ${payload.headline}`);
  if (payload.company) lines.push(`Company: ${payload.company}`);
  if (payload.location) lines.push(`Location: ${payload.location}`);
  lines.push(`LinkedIn: ${payload.profile_url}`);
  
  const content = lines.join("\n");
  const title = payload.full_name 
    ? `Connected with ${payload.full_name} on LinkedIn`
    : `New LinkedIn Connection: ${payload.public_identifier}`;
  
  const body = {
    userKey,
    content,
    source: "linkedin",
    entityType: "contact",
    occurredAt: payload.occurred_at,
    tags: ["linkedin", "contact", "networking"],
    metadata: {
      profileUrl: payload.profile_url,
      publicIdentifier: payload.public_identifier,
      fullName: payload.full_name,
      headline: payload.headline,
      company: payload.company,
      location: payload.location,
      avatarUrl: payload.avatar_url,
      dedupeKey,
    },
  };
  
  const bodyString = JSON.stringify(body);
  const signature = await signWithECDSA(bodyString, LIAM_PRIVATE_KEY);
  
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": LIAM_API_KEY,
        "x-signature": signature,
      },
      body: bodyString,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("LIAM API error:", response.status, errorText);
      return { success: false, error: `API error: ${response.status}` };
    }
    
    const result = await response.json();
    return { success: true, memoryId: result.id || result.memoryId };
  } catch (error) {
    console.error("LIAM API request failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client with user's token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth verification failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const userId = user.id;
    console.log(`Received connection event from user: ${userId}`);
    
    // Parse request body
    const payload: ConnectionEventPayload = await req.json();
    
    // Validate required fields
    if (!payload.profile_url || !payload.public_identifier) {
      return new Response(JSON.stringify({ error: "Missing required fields: profile_url, public_identifier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Normalize profile URL
    const normalizedUrl = normalizeProfileUrl(payload.profile_url);
    const dedupeKey = generateDedupeKey(userId, normalizedUrl);
    
    console.log(`Processing connection: ${payload.public_identifier}, dedupe: ${dedupeKey}`);
    
    // Log the event
    await supabase.from("linkedin_extension_events").insert({
      user_id: userId,
      profile_url: normalizedUrl,
      public_identifier: payload.public_identifier,
      full_name: payload.full_name,
      headline: payload.headline,
      company: payload.company,
      location: payload.location,
      avatar_url: payload.avatar_url,
      occurred_at: payload.occurred_at,
      status: "received",
    });
    
    // Check for duplicate in processed connections
    const { data: existing } = await supabase
      .from("linkedin_processed_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("linkedin_connection_id", normalizedUrl)
      .maybeSingle();
    
    if (existing) {
      console.log(`Duplicate connection: ${normalizedUrl}`);
      
      // Update event status
      await supabase
        .from("linkedin_extension_events")
        .update({ status: "duplicate" })
        .eq("user_id", userId)
        .eq("profile_url", normalizedUrl)
        .order("created_at", { ascending: false })
        .limit(1);
      
      return new Response(JSON.stringify({ saved: false, reason: "duplicate" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get user's API key for LIAM
    const { data: apiKeyData } = await supabase
      .from("user_api_keys")
      .select("user_key")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!apiKeyData?.user_key) {
      console.error("User API key not found for user:", userId);
      
      await supabase
        .from("linkedin_extension_events")
        .update({ status: "error", error_message: "User API key not found" })
        .eq("user_id", userId)
        .eq("profile_url", normalizedUrl)
        .order("created_at", { ascending: false })
        .limit(1);
      
      return new Response(JSON.stringify({ saved: false, reason: "no_api_key" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Create memory via LIAM API
    const memoryResult = await createMemory(apiKeyData.user_key, { ...payload, profile_url: normalizedUrl }, dedupeKey);
    
    if (!memoryResult.success) {
      console.error("Failed to create memory:", memoryResult.error);
      
      await supabase
        .from("linkedin_extension_events")
        .update({ status: "error", error_message: memoryResult.error })
        .eq("user_id", userId)
        .eq("profile_url", normalizedUrl)
        .order("created_at", { ascending: false })
        .limit(1);
      
      return new Response(JSON.stringify({ saved: false, reason: "memory_creation_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Mark as processed
    await supabase.from("linkedin_processed_connections").insert({
      user_id: userId,
      linkedin_connection_id: normalizedUrl,
    });
    
    // Update event status
    await supabase
      .from("linkedin_extension_events")
      .update({ status: "saved" })
      .eq("user_id", userId)
      .eq("profile_url", normalizedUrl)
      .order("created_at", { ascending: false })
      .limit(1);
    
    // Update automation config stats
    try {
      await supabase.rpc("increment", { x: 1, row_id: userId });
    } catch {
      // Ignore if rpc doesn't exist
    }
    
    // Update connections tracked count
    const { data: configData } = await supabase
      .from("linkedin_automation_config")
      .select("id, connections_tracked")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (configData) {
      await supabase
        .from("linkedin_automation_config")
        .update({
          connections_tracked: (configData.connections_tracked || 0) + 1,
          extension_last_event_at: new Date().toISOString(),
          extension_enabled: true,
        })
        .eq("id", configData.id);
    }
    
    console.log(`Successfully saved connection: ${payload.public_identifier}, memory: ${memoryResult.memoryId}`);
    
    return new Response(JSON.stringify({ 
      saved: true, 
      memory_id: memoryResult.memoryId,
      dedupe_key: dedupeKey,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
