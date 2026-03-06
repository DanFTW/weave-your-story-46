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

// === FORMAT TRADE AS MEMORY ===

function formatTradeAsMemory(trade: any, productId: string): string {
  const parts = ["Coinbase Trade", ""];
  parts.push(`Pair: ${productId}`);
  if (trade.side) parts.push(`Side: ${trade.side}`);
  if (trade.size) parts.push(`Size: ${trade.size}`);
  if (trade.price) parts.push(`Price: $${Number(trade.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`);
  if (trade.time) parts.push(`Time: ${trade.time}`);
  if (trade.trade_id) parts.push(`Trade ID: ${trade.trade_id}`);
  parts.push("");
  parts.push("A trade was executed on Coinbase.");
  return parts.join("\n");
}

// === SAFE JSON PARSE ===

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[Coinbase] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
}

// === EXTRACT DATA FROM COMPOSIO RESPONSE ===

function extractResponseData(toolData: any): any {
  if (toolData?.data?.response_data) return toolData.data.response_data;
  if (toolData?.data?.data?.response_data) return toolData.data.data.response_data;
  if (toolData?.data?.data) return toolData.data.data;
  if (toolData?.data) return toolData.data;
  if (toolData?.response_data) return toolData.response_data;
  return toolData;
}

// === POLL COINBASE TRADES VIA COMPOSIO ===

async function pollCoinbaseTrades(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching trades for user ${userId}`);

  // Get current config for last_trade_timestamp cursor
  const { data: currentConfig } = await supabaseClient
    .from("coinbase_trades_config")
    .select("last_trade_timestamp, trades_tracked")
    .eq("user_id", userId)
    .maybeSingle();

  const lastTradeTimestamp = currentConfig?.last_trade_timestamp;
  const isBackfill = !lastTradeTimestamp;
  console.log(`[Coinbase Poll] Mode: ${isBackfill ? 'full backfill' : 'incremental'}, cursor: ${lastTradeTimestamp || 'none'}`);

  // Step 1: Get all trading products
  const productsResponse = await fetch(
    "https://backend.composio.dev/api/v3/tools/execute/COINBASE_LIST_PRODUCTS",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
      body: JSON.stringify({ connected_account_id: connectionId, arguments: {} }),
    }
  );

  const productsText = await productsResponse.text();
  if (!productsResponse.ok) {
    console.error("[Coinbase Poll] Products fetch error:", productsText.slice(0, 500));
    throw new Error(`Failed to fetch products: ${productsResponse.status}`);
  }

  const productsData = safeJsonParse(productsText);
  const rawProducts = extractResponseData(productsData);
  let products: any[] = Array.isArray(rawProducts) ? rawProducts : (rawProducts?.products || rawProducts?.data || []);

  // Limit to active trading pairs to avoid excessive API calls
  products = products.filter((p: any) => p.status === 'online' || !p.status);
  console.log(`[Coinbase Poll] Found ${products.length} active products`);

  // Cap products to prevent timeouts (most relevant pairs first)
  const maxProducts = isBackfill ? 20 : 50;
  if (products.length > maxProducts) {
    products = products.slice(0, maxProducts);
    console.log(`[Coinbase Poll] Capped to ${maxProducts} products`);
  }

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let totalNewTrades = 0;
  let latestTimestamp = lastTradeTimestamp;

  // Step 2: For each product, fetch trades with pagination
  for (const product of products) {
    const productId = product.id || product.product_id;
    if (!productId) continue;

    let hasMore = true;
    let cursor: string | undefined;
    let productTradeCount = 0;
    const maxTradesPerProduct = isBackfill ? 100 : 50;

    while (hasMore && productTradeCount < maxTradesPerProduct) {
      const args: Record<string, any> = { product_id: productId, limit: 100 };
      if (cursor) args.after = cursor;

      try {
        const tradesResponse = await fetch(
          "https://backend.composio.dev/api/v3/tools/execute/COINBASE_LIST_PRODUCTS_TRADES",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
            body: JSON.stringify({ connected_account_id: connectionId, arguments: args }),
          }
        );

        if (!tradesResponse.ok) {
          console.error(`[Coinbase Poll] Trades error for ${productId}: ${tradesResponse.status}`);
          break;
        }

        const tradesText = await tradesResponse.text();
        const tradesData = safeJsonParse(tradesText);
        const rawTrades = extractResponseData(tradesData);
        const trades: any[] = Array.isArray(rawTrades) ? rawTrades : (rawTrades?.trades || rawTrades?.data || []);

        if (trades.length === 0) {
          hasMore = false;
          break;
        }

        // Filter trades newer than cursor (incremental mode)
        const filteredTrades = lastTradeTimestamp
          ? trades.filter((t: any) => t.time && new Date(t.time) > new Date(lastTradeTimestamp))
          : trades;

        if (filteredTrades.length === 0) {
          hasMore = false;
          break;
        }

        // Batch check for already-processed trade IDs
        const tradeIds = filteredTrades.map((t: any) => String(t.trade_id));
        const { data: existing } = await supabaseClient
          .from("coinbase_processed_trades")
          .select("coinbase_trade_id")
          .eq("user_id", userId)
          .in("coinbase_trade_id", tradeIds);

        const existingIds = new Set((existing || []).map((e: any) => e.coinbase_trade_id));
        const newTrades = filteredTrades.filter((t: any) => !existingIds.has(String(t.trade_id)));

        // Process new trades
        for (let i = 0; i < newTrades.length; i++) {
          const trade = newTrades[i];
          const tradeId = String(trade.trade_id);

          // Insert into processed trades (dedup)
          const { error: insertError } = await supabaseClient
            .from("coinbase_processed_trades")
            .insert({ user_id: userId, coinbase_trade_id: tradeId });

          if (insertError) {
            // Duplicate — skip
            if (insertError.code === '23505') continue;
            console.error(`[Coinbase Poll] Insert error:`, insertError);
            continue;
          }

          // Create memory
          if (apiKeys) {
            const memoryContent = formatTradeAsMemory(trade, productId);
            const success = await createMemory(apiKeys, memoryContent);
            if (success) totalNewTrades++;
          }

          // Track latest timestamp
          if (trade.time && (!latestTimestamp || new Date(trade.time) > new Date(latestTimestamp))) {
            latestTimestamp = trade.time;
          }

          // Rate limit: 500ms every 10 writes
          if (i > 0 && i % 10 === 0) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        productTradeCount += trades.length;

        // Pagination: use last trade_id as cursor if available
        if (trades.length < 100) {
          hasMore = false;
        } else {
          cursor = String(trades[trades.length - 1]?.trade_id);
        }
      } catch (err) {
        console.error(`[Coinbase Poll] Error fetching trades for ${productId}:`, err);
        break;
      }
    }
  }

  // Update config stats
  const newTotal = (currentConfig?.trades_tracked || 0) + totalNewTrades;

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
