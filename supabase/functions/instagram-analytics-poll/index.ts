import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";

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
  der.set(seqLen, offset); offset += seqLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset); offset += rLen.length;
  der.set(rPadded, offset); offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset); offset += sLen.length;
  der.set(sPadded, offset);
  return btoa(String.fromCharCode(...der));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey("pkcs8", binaryDer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
  return toDER(new Uint8Array(signature));
}

// deno-lint-ignore no-explicit-any
async function createMemory(apiKeys: any, content: string): Promise<boolean> {
  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body = { userKey: apiKeys.user_key, content, tag: "INSTAGRAM" };
    const signature = await signRequest(privateKey, body);
    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apiKey": apiKeys.api_key, "signature": signature },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Instagram Analytics] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[Instagram Analytics] Error creating memory:", error);
    return false;
  }
}

// === COMPOSIO TOOL EXECUTION ===

// deno-lint-ignore no-explicit-any
async function executeComposioAction(actionName: string, connectionId: string, input: Record<string, any> = {}): Promise<any> {
  console.log(`[Composio] Executing ${actionName} with connectionId=${connectionId}`);

  const response = await fetch(
    `https://backend.composio.dev/api/v3/tools/execute/${actionName}`,
    {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: input,
      }),
    }
  );

  const text = await response.text();
  console.log(`[Composio] ${actionName} status=${response.status}, response (first 2000 chars):\n${text.slice(0, 2000)}`);

  if (!response.ok) {
    throw new Error(`Composio action ${actionName} failed: ${response.status} ${text.slice(0, 300)}`);
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed.successful === false || parsed.data?.successful === false) {
      const errMsg = parsed.error || parsed.data?.error || parsed.data?.message || "Unknown Composio error";
      throw new Error(`Composio action ${actionName} unsuccessful: ${errMsg}`);
    }
    return parsed.data?.response_data || parsed.response_data || parsed.data || parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return text;
    throw e;
  }
}

function isExpiredConnectedAccountError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes("ActionExecute_ConnectedAccountExpired") ||
    error.message.includes("is in EXPIRED state")
  );
}

function createReconnectResponse(): Response {
  return new Response(JSON.stringify({
    success: false,
    needsReconnect: true,
    code: "INSTAGRAM_CONNECTION_EXPIRED",
    error: "Instagram connection expired. Please reconnect Instagram and try again.",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// === FORMAT INSIGHTS AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatInsightsAsMemory(insights: any, date: string): string {
  const lines: string[] = [
    "Instagram Analytics Snapshot",
    "",
    `Date: ${date}`,
    "",
  ];

  // Handle different response shapes from INSTAGRAM_GET_USER_INSIGHTS
  if (Array.isArray(insights)) {
    for (const metric of insights) {
      const name = metric.name || metric.title || "Unknown Metric";
      const value = metric.values?.[0]?.value ?? metric.value ?? metric.total ?? "N/A";
      const description = metric.description || "";
      lines.push(`${name}: ${value}${description ? ` — ${description}` : ""}`);
    }
  } else if (typeof insights === "object" && insights !== null) {
    // Flat object shape
    for (const [key, value] of Object.entries(insights)) {
      if (key === "successful" || key === "error") continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`${label}: ${value}`);
    }
  }

  lines.push("", "A snapshot of Instagram account analytics was captured.");
  return lines.join("\n");
}

// === POLL INSTAGRAM INSIGHTS ===

async function pollInstagramInsights(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newInsights: number; totalCollected: number }> {
  console.log(`[Instagram Analytics] Fetching insights for user ${userId}`);

  const { data: currentConfig } = await supabaseClient
    .from("instagram_analytics_config")
    .select("insights_collected")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    throw new Error("LIAM API keys not configured. Please set up your API keys first.");
  }

  const today = new Date().toISOString().split("T")[0];
  const dedupeKey = `insights_${today}`;

  // Check if already collected today
  const { data: existing } = await supabaseClient
    .from("instagram_analytics_processed")
    .select("id, insights_data")
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing && existing.insights_data !== null) {
    console.log("[Instagram Analytics] Already collected for today with data, skipping");
    return { newInsights: 0, totalCollected: currentConfig?.insights_collected ?? 0 };
  }

  // If existing row has NULL insights_data, we'll backfill it below
  const needsBackfill = existing && existing.insights_data === null;
  if (needsBackfill) {
    console.log("[Instagram Analytics] Found existing row with NULL insights_data, backfilling...");
  }

  // Execute INSTAGRAM_GET_USER_INSIGHTS via Composio
  const insightsPayload = { metric: ["reach", "profile_views", "follower_count", "accounts_engaged"], period: "day" };
  console.log("[Instagram Analytics] Outbound Composio payload:", JSON.stringify(insightsPayload));
  const insightsResult = await executeComposioAction(
    "INSTAGRAM_GET_USER_INSIGHTS",
    connectionId,
    insightsPayload
  );

  // Record dedup or backfill
  if (needsBackfill) {
    const { error: updateError } = await supabaseClient
      .from("instagram_analytics_processed")
      .update({ insights_data: insightsResult })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[Instagram Analytics] Backfill update error:", updateError);
    } else {
      console.log("[Instagram Analytics] Backfilled insights_data for existing row");
    }
    // No new memory — it was already sent on original insert
    return { newInsights: 0, totalCollected: currentConfig?.insights_collected ?? 0 };
  }

  const { error: insertError } = await supabaseClient
    .from("instagram_analytics_processed")
    .insert({ user_id: userId, dedupe_key: dedupeKey, insights_data: insightsResult });

  if (insertError && insertError.code !== "23505") {
    console.error("[Instagram Analytics] Dedup insert error:", insertError);
  }

  // Create memory
  const memoryContent = formatInsightsAsMemory(insightsResult, today);
  const success = await createMemory(apiKeys, memoryContent);
  const newCount = success ? 1 : 0;

  // Update config stats
  const newTotal = (currentConfig?.insights_collected ?? 0) + newCount;
  await supabaseClient
    .from("instagram_analytics_config")
    .update({
      insights_collected: newTotal,
      last_polled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  console.log(`[Instagram Analytics] Done. ${newCount} new, ${newTotal} total`);
  return { newInsights: newCount, totalCollected: newTotal };
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    console.log(`[Instagram Analytics] Action: ${action}, User: ${userId}`);

    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "instagram")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Instagram not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    if (action === "activate") {
      try {
        const result = await pollInstagramInsights(supabaseClient, userId, connectionId);
        // Only set is_active=true after a successful first poll
        await supabaseClient
          .from("instagram_analytics_config")
          .update({ is_active: true })
          .eq("user_id", userId);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (activateErr) {
        console.error("[Instagram Analytics] Activate poll failed, leaving is_active=false:", activateErr);
        if (isExpiredConnectedAccountError(activateErr)) {
          return createReconnectResponse();
        }
        return new Response(
          JSON.stringify({ error: activateErr instanceof Error ? activateErr.message : "Activation poll failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "deactivate") {
      await supabaseClient
        .from("instagram_analytics_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "manual-poll") {
      try {
        const result = await pollInstagramInsights(supabaseClient, userId, connectionId);
        return new Response(JSON.stringify({ success: true, ...result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (pollErr) {
        console.error("[Instagram Analytics] Manual poll failed:", pollErr);
        if (isExpiredConnectedAccountError(pollErr)) {
          return createReconnectResponse();
        }
        return new Response(
          JSON.stringify({ error: pollErr instanceof Error ? pollErr.message : "Manual poll failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Instagram Analytics] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
