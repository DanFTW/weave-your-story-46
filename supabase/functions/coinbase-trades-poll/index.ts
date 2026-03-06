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

// === COMPOSIO TOOL EXECUTION ===

// deno-lint-ignore no-explicit-any
async function executeComposioAction(actionName: string, connectionId: string, input: Record<string, any> = {}): Promise<any> {
  console.log(`[Composio] Executing ${actionName} with connectionId=${connectionId}, input=${JSON.stringify(input)}`);
  
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
  console.log(`[Composio] ${actionName} status=${response.status}, full response (first 1500 chars):\n${text.slice(0, 1500)}`);

  if (!response.ok) {
    // Parse error details for diagnostic clarity
    try {
      const errBody = JSON.parse(text);
      const slug = errBody?.error?.slug || errBody?.slug || "unknown";
      const msg = errBody?.error?.message || errBody?.message || text.slice(0, 300);
      console.error(`[Composio] DIAGNOSTIC: action=${actionName}, connectionId=${connectionId}, status=${response.status}, slug=${slug}, message=${msg}`);
    } catch {
      console.error(`[Composio] DIAGNOSTIC: action=${actionName}, connectionId=${connectionId}, status=${response.status}, rawBody=${text.slice(0, 500)}`);
    }
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

// === FORMAT TRADE AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatTradeAsMemory(trade: any, productId: string): string {
  const side = trade.side || "unknown";
  const size = trade.size || trade.quantity || "?";
  const price = trade.price || "?";
  const time = trade.time || trade.timestamp || new Date().toISOString();
  const tradeId = trade.trade_id || trade.id || "?";

  const formattedPrice = typeof price === "number" || !isNaN(Number(price))
    ? `$${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : price;

  return [
    "Coinbase Trade",
    "",
    `Pair: ${productId}`,
    `Side: ${side}`,
    `Size: ${size}`,
    `Price: ${formattedPrice}`,
    `Time: ${time}`,
    `Trade ID: ${tradeId}`,
    "",
    `A ${side} trade was executed on Coinbase for ${productId}.`,
  ].join("\n");
}

// === EXTRACT ARRAY FROM COMPOSIO RESPONSE ===

// deno-lint-ignore no-explicit-any
function extractArray(result: any, key?: string): any[] {
  if (Array.isArray(result)) return result;
  if (key && result?.[key]) return result[key];
  if (typeof result === "object" && result !== null) {
    for (const k of Object.keys(result)) {
      if (Array.isArray(result[k])) return result[k];
    }
  }
  return [];
}

// === POLL COINBASE TRADES VIA COMPOSIO EXCHANGE ACTIONS ===

async function pollCoinbaseTrades(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching trades for user ${userId}`);

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

  // Use hardcoded major trading pairs since COINBASE_LIST_EXCHANGE_PRODUCTS is not available
  const productsToScan = [
    "BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD", "ADA-USD",
    "XRP-USD", "DOT-USD", "AVAX-USD", "MATIC-USD", "LINK-USD",
    "BTC-USDT", "ETH-USDT", "BTC-EUR", "ETH-EUR",
  ];
  console.log(`[Coinbase Poll] Scanning ${productsToScan.length} major trading pairs`);

  // For each product, fetch recent trades via COINBASE_LIST_PRODUCTS_TRADES
  for (const productId of productsToScan) {

    try {
      let cursor: number | null = null;
      let hasMore = true;
      let pageCount = 0;
      const maxPages = 3;

      while (hasMore && pageCount < maxPages) {
        // deno-lint-ignore no-explicit-any
        const input: Record<string, any> = { product_id: productId, limit: 100 };
        if (cursor !== null) input.after = cursor;

        const tradesResult = await executeComposioAction("COINBASE_LIST_PRODUCTS_TRADES", connectionId, input);
        const trades = extractArray(tradesResult, "trades");

        if (trades.length === 0) { hasMore = false; break; }

        console.log(`[Coinbase Poll] ${productId}: page ${pageCount + 1}, ${trades.length} trades`);

        let hitCutoff = false;
        for (const trade of trades) {
          const tradeTime = trade.time || trade.timestamp;
          const tradeId = String(trade.trade_id || trade.id || "");

          if (cutoffTimestamp && tradeTime && tradeTime <= cutoffTimestamp) {
            hitCutoff = true;
            break;
          }

          const dedupeId = `trade_${productId}_${tradeId}`;

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

          const memoryContent = formatTradeAsMemory(trade, productId);
          const success = await createMemory(apiKeys, memoryContent);
          if (success) totalNewTrades++;

          if (tradeTime && (!latestTimestamp || tradeTime > latestTimestamp)) {
            latestTimestamp = tradeTime;
          }
        }

        if (hitCutoff) {
          hasMore = false;
        } else {
          const lastTrade = trades[trades.length - 1];
          const lastId = lastTrade?.trade_id || lastTrade?.id;
          cursor = lastId ? Number(lastId) : null;
          if (!cursor) hasMore = false;
        }

        pageCount++;
      }
    } catch (productErr) {
      const errMsg = productErr instanceof Error ? productErr.message : String(productErr);
      console.error(`[Coinbase Poll] FAILED for ${productId}: ${errMsg}`);
      // Re-throw on connection-level errors so caller knows polling is broken
      if (errMsg.includes("ConnectedAccountExpired") || errMsg.includes("Auth_Config")) {
        throw productErr;
      }
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
    console.log(`[Coinbase Trades] Using connectionId: ${connectionId} (prefix: ${connectionId.slice(0, 3)})`);

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
