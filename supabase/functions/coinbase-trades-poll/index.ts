import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory";
const COINBASE_API_BASE = "https://api.coinbase.com";

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
    const body = { userKey: apiKeys.user_key, content };
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

// === GET COINBASE ACCESS TOKEN FROM COMPOSIO ===

async function getCoinbaseAccessToken(connectionId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      {
        method: "GET",
        headers: { "x-api-key": COMPOSIO_API_KEY },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Coinbase] Composio connection fetch error:", response.status, errorText.slice(0, 500));
      return null;
    }

    const connData = await response.json();
    const data = connData.data || connData;
    const accessToken = data.access_token || data.connectionParams?.access_token;

    if (!accessToken || accessToken.includes("...")) {
      console.error("[Coinbase] Access token missing or masked. Ensure masking is disabled in Composio org settings.");
      return null;
    }

    return accessToken;
  } catch (error) {
    console.error("[Coinbase] Error getting access token:", error);
    return null;
  }
}

// === COINBASE ADVANCED TRADE API HELPERS ===

// deno-lint-ignore no-explicit-any
async function coinbaseGet(path: string, accessToken: string): Promise<any> {
  const url = `${COINBASE_API_BASE}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Coinbase] API error ${path}: ${response.status} ${errorText.slice(0, 500)}`);
    throw new Error(`Coinbase API ${response.status}: ${path}`);
  }

  return await response.json();
}

// === FORMAT TRADE AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatFillAsMemory(fill: any): string {
  const parts = ["Coinbase Trade", ""];
  if (fill.product_id) parts.push(`Pair: ${fill.product_id}`);
  if (fill.side) parts.push(`Side: ${fill.side}`);
  if (fill.size) parts.push(`Size: ${fill.size}`);
  if (fill.price) parts.push(`Price: $${Number(fill.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
  if (fill.trade_time) parts.push(`Time: ${fill.trade_time}`);
  if (fill.trade_id) parts.push(`Trade ID: ${fill.trade_id}`);
  if (fill.order_id) parts.push(`Order ID: ${fill.order_id}`);
  if (fill.commission) parts.push(`Fee: $${fill.commission}`);
  parts.push("");
  parts.push("A trade was executed on Coinbase.");
  return parts.join("\n");
}

// === POLL COINBASE TRADES VIA ADVANCED TRADE API ===

async function pollCoinbaseTrades(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching trades for user ${userId}`);

  // Get access token from Composio
  const accessToken = await getCoinbaseAccessToken(connectionId);
  if (!accessToken) {
    throw new Error("Could not retrieve Coinbase access token from Composio");
  }

  // Get current config for cursor
  const { data: currentConfig } = await supabaseClient
    .from("coinbase_trades_config")
    .select("last_trade_timestamp, trades_tracked")
    .eq("user_id", userId)
    .maybeSingle();

  const lastTradeTimestamp = currentConfig?.last_trade_timestamp;
  const isBackfill = !lastTradeTimestamp;
  console.log(`[Coinbase Poll] Mode: ${isBackfill ? 'full backfill' : 'incremental'}, cursor: ${lastTradeTimestamp || 'none'}`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let totalNewTrades = 0;
  let latestTimestamp = lastTradeTimestamp;
  let cursor: string | undefined;
  let hasMore = true;

  // Paginate through all fills using the Advanced Trade API
  // GET /api/v3/brokerage/orders/historical/fills
  while (hasMore) {
    let path = `/api/v3/brokerage/orders/historical/fills?limit=100`;
    if (cursor) path += `&cursor=${encodeURIComponent(cursor)}`;
    if (lastTradeTimestamp) {
      path += `&start_sequence_timestamp=${encodeURIComponent(lastTradeTimestamp)}`;
    }

    try {
      const fillsData = await coinbaseGet(path, accessToken);
      const fills = fillsData.fills || [];
      cursor = fillsData.cursor || undefined;

      console.log(`[Coinbase Poll] Got ${fills.length} fills, cursor: ${cursor ? 'yes' : 'none'}`);

      if (fills.length === 0) {
        hasMore = false;
        break;
      }

      // Filter out already-processed fills by trade_id
      const tradeIds = fills
        // deno-lint-ignore no-explicit-any
        .filter((f: any) => f.trade_id)
        // deno-lint-ignore no-explicit-any
        .map((f: any) => String(f.trade_id));

      const { data: existing } = await supabaseClient
        .from("coinbase_processed_trades")
        .select("coinbase_trade_id")
        .eq("user_id", userId)
        .in("coinbase_trade_id", tradeIds);

      // deno-lint-ignore no-explicit-any
      const existingIds = new Set((existing || []).map((e: any) => e.coinbase_trade_id));
      // deno-lint-ignore no-explicit-any
      const newFills = fills.filter((f: any) => f.trade_id && !existingIds.has(String(f.trade_id)));

      // Process new fills
      for (let i = 0; i < newFills.length; i++) {
        const fill = newFills[i];
        const tradeId = String(fill.trade_id);

        // Insert into processed trades (dedup)
        const { error: insertError } = await supabaseClient
          .from("coinbase_processed_trades")
          .insert({ user_id: userId, coinbase_trade_id: tradeId });

        if (insertError) {
          if (insertError.code === '23505') continue; // duplicate
          console.error(`[Coinbase Poll] Insert error:`, insertError);
          continue;
        }

        // Create memory
        if (apiKeys) {
          const memoryContent = formatFillAsMemory(fill);
          const success = await createMemory(apiKeys, memoryContent);
          if (success) totalNewTrades++;
        }

        // Track latest timestamp
        if (fill.trade_time && (!latestTimestamp || new Date(fill.trade_time) > new Date(latestTimestamp))) {
          latestTimestamp = fill.trade_time;
        }

        // Rate limit: 500ms every 10 writes
        if (i > 0 && i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // If cursor is empty or all fills were already seen, stop
      if (!cursor || cursor === "" || newFills.length === 0) {
        hasMore = false;
      }
    } catch (err) {
      console.error(`[Coinbase Poll] Error fetching fills:`, err);
      hasMore = false;
    }
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

  console.log(`[Coinbase Poll] Done. ${totalNewTrades} new trades, ${newTotal} total`);
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

    // Get user's Coinbase connection
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

    // === ACTIVATE ===
    if (action === "activate") {
      await supabaseClient
        .from("coinbase_trades_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      const result = await pollCoinbaseTrades(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE ===
    if (action === "deactivate") {
      await supabaseClient
        .from("coinbase_trades_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL POLL ===
    if (action === "manual-poll") {
      const result = await pollCoinbaseTrades(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Coinbase Trades] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
