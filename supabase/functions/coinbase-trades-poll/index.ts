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
    const body = { userKey: apiKeys.user_key, content, tag: "COINBASE" };
    const signature = await signRequest(privateKey, body);
    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apiKey": apiKeys.api_key, "signature": signature },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Coinbase] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[Coinbase] Error creating memory:", error);
    return false;
  }
}

// === COMPOSIO PROXY: LIST FILLS ===

// deno-lint-ignore no-explicit-any
async function fetchFillsViaProxy(connectionId: string, cursor?: string): Promise<any> {
  // deno-lint-ignore no-explicit-any
  const parameters: any[] = [
    { name: "limit", in: "query", value: "100" },
  ];
  if (cursor) {
    parameters.push({ name: "cursor", in: "query", value: cursor });
  }

  console.log(`[Composio Proxy] Fetching fills, cursor=${cursor || "none"}`);

  const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/proxy", {
    method: "POST",
    headers: {
      "x-api-key": COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connectedAccountId: connectionId,
      endpoint: "api/v3/brokerage/orders/historical/fills",
      method: "GET",
      parameters,
    }),
  });

  const text = await response.text();
  console.log(`[Composio Proxy] List Fills status=${response.status}, response (first 1500 chars):\n${text.slice(0, 1500)}`);

  if (!response.ok) {
    throw new Error(`Composio Proxy List Fills failed: ${response.status} ${text.slice(0, 300)}`);
  }

  try {
    const parsed = JSON.parse(text);
    // The proxy may wrap the response — extract the actual Coinbase response
    return parsed.data?.response_data || parsed.response_data || parsed.data || parsed;
  } catch {
    throw new Error(`Failed to parse Composio Proxy response: ${text.slice(0, 300)}`);
  }
}

// === FORMAT FILL AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatFillAsMemory(fill: any): string {
  const productId = fill.product_id || "unknown";
  const side = fill.side || "unknown";
  const size = fill.size || fill.size_in_quote || "?";
  const price = fill.price || "?";
  const commission = fill.commission || "0";
  const time = fill.trade_time || fill.created_at || new Date().toISOString();
  const tradeId = fill.trade_id || fill.entry_id || "?";

  const formattedPrice = typeof price === "number" || !isNaN(Number(price))
    ? `$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : price;

  const formattedCommission = typeof commission === "number" || !isNaN(Number(commission))
    ? `$${Number(commission).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
    : commission;

  return [
    "Coinbase Trade",
    "",
    `Pair: ${productId}`,
    `Side: ${side}`,
    `Size: ${size}`,
    `Price: ${formattedPrice}`,
    `Commission: ${formattedCommission}`,
    `Time: ${time}`,
    `Trade ID: ${tradeId}`,
    "",
    `A ${side} trade was executed on Coinbase for ${productId}.`,
  ].join("\n");
}

// === EXTRACT FILLS ARRAY FROM RESPONSE ===

// deno-lint-ignore no-explicit-any
function extractFills(result: any): { fills: any[]; cursor: string | null } {
  // Coinbase List Fills returns { fills: [...], cursor: "..." }
  if (result?.fills && Array.isArray(result.fills)) {
    return { fills: result.fills, cursor: result.cursor || null };
  }
  // Fallback: try to find an array in the response
  if (Array.isArray(result)) {
    return { fills: result, cursor: null };
  }
  if (typeof result === "object" && result !== null) {
    for (const k of Object.keys(result)) {
      if (Array.isArray(result[k])) {
        return { fills: result[k], cursor: result.cursor || null };
      }
    }
  }
  return { fills: [], cursor: null };
}

// === POLL COINBASE FILLS VIA COMPOSIO PROXY ===

async function pollCoinbaseTrades(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching fills for user ${userId}`);

  const { data: currentConfig } = await supabaseClient
    .from("coinbase_trades_config")
    .select("last_trade_timestamp, trades_tracked")
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

  let totalNewTrades = 0;
  let latestTimestamp = currentConfig?.last_trade_timestamp;
  const cutoffTimestamp = currentConfig?.last_trade_timestamp || null;

  let cursor: string | null = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 5;

  while (hasMore && pageCount < maxPages) {
    const result = await fetchFillsViaProxy(connectionId, cursor || undefined);
    const { fills, cursor: nextCursor } = extractFills(result);

    if (fills.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`[Coinbase Poll] Page ${pageCount + 1}: ${fills.length} fills`);

    let hitCutoff = false;
    for (const fill of fills) {
      const tradeTime = fill.trade_time || fill.created_at;
      const tradeId = String(fill.trade_id || fill.entry_id || "");

      // Stop if we've reached previously processed fills
      if (cutoffTimestamp && tradeTime && tradeTime <= cutoffTimestamp) {
        hitCutoff = true;
        break;
      }

      const dedupeId = `fill_${tradeId}`;

      const { data: existing } = await supabaseClient
        .from("coinbase_processed_trades")
        .select("coinbase_trade_id")
        .eq("user_id", userId)
        .eq("coinbase_trade_id", dedupeId)
        .maybeSingle();

      if (existing) continue;

      const { error: insertError } = await supabaseClient
        .from("coinbase_processed_trades")
        .insert({ user_id: userId, coinbase_trade_id: dedupeId });

      if (insertError) {
        if (insertError.code === "23505") continue;
        console.error("[Coinbase Poll] Insert error:", insertError);
        continue;
      }

      const memoryContent = formatFillAsMemory(fill);
      const success = await createMemory(apiKeys, memoryContent);
      if (success) totalNewTrades++;

      if (tradeTime && (!latestTimestamp || tradeTime > latestTimestamp)) {
        latestTimestamp = tradeTime;
      }
    }

    if (hitCutoff || !nextCursor) {
      hasMore = false;
    } else {
      cursor = nextCursor;
    }

    pageCount++;
  }

  // Update config stats
  const newTotal = (currentConfig?.trades_tracked || 0) + totalNewTrades;
  // deno-lint-ignore no-explicit-any
  const updatePayload: Record<string, any> = {
    trades_tracked: newTotal,
    last_polled_at: new Date().toISOString(),
  };
  if (latestTimestamp) {
    updatePayload.last_trade_timestamp = latestTimestamp;
  }

  await supabaseClient
    .from("coinbase_trades_config")
    .update(updatePayload)
    .eq("user_id", userId);

  console.log(`[Coinbase Poll] Done. ${totalNewTrades} new, ${newTotal} total`);
  return { newTrades: totalNewTrades, totalTracked: newTotal };
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
    console.log(`[Coinbase Trades] Action: ${action}, User: ${userId}`);

    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "coinbase")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Coinbase not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;
    console.log(`[Coinbase Trades] Using connectionId: ${connectionId}`);

    if (action === "activate") {
      await supabaseClient
        .from("coinbase_trades_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      const result = await pollCoinbaseTrades(supabaseClient, userId, connectionId);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      await supabaseClient
        .from("coinbase_trades_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "manual-poll") {
      const result = await pollCoinbaseTrades(supabaseClient, userId, connectionId);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Coinbase Trades] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
