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

// === COINBASE AUTH — resolve credentials from Composio connected account ===

interface CoinbaseAuth {
  type: "oauth" | "apikey";
  accessToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

async function resolveCoinbaseAuth(connectionId: string): Promise<CoinbaseAuth | null> {
  try {
    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      { method: "GET", headers: { "x-api-key": COMPOSIO_API_KEY } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Coinbase Auth] Composio fetch error:", response.status, errorText.slice(0, 500));
      return null;
    }

    const connData = await response.json();
    const data = connData.data || connData;
    const connParams = data.connectionParams || connData.connectionParams || {};
    const authScheme = data.auth_scheme || connData.auth_scheme || "";

    console.log(`[Coinbase Auth] auth_scheme=${authScheme}, connParams keys=${Object.keys(connParams).join(",")}`);

    // Try OAuth access_token first
    const accessToken =
      data.access_token ||
      connParams.access_token ||
      connData.access_token;

    if (accessToken && !String(accessToken).includes("...")) {
      console.log("[Coinbase Auth] Resolved OAuth access_token");
      return { type: "oauth", accessToken };
    }

    // Try API key credentials
    const apiKey = connParams.api_key || connParams.apiKey || connParams.API_KEY || connParams.key;
    const apiSecret = connParams.api_secret || connParams.apiSecret || connParams.API_SECRET || connParams.secret;

    if (apiKey && apiSecret) {
      console.log("[Coinbase Auth] Resolved API key credentials");
      return { type: "apikey", apiKey, apiSecret };
    }

    // Log all available keys for debugging
    console.error(`[Coinbase Auth] Could not resolve credentials. Data keys: ${Object.keys(data).join(",")}, connParams keys: ${Object.keys(connParams).join(",")}`);
    return null;
  } catch (error) {
    console.error("[Coinbase Auth] Error:", error);
    return null;
  }
}

// === COINBASE API HELPERS ===

// HMAC-SHA256 signing for Coinbase API_KEY auth
async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  // Coinbase expects hex-encoded HMAC
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// deno-lint-ignore no-explicit-any
async function coinbaseApiGet(path: string, auth: CoinbaseAuth): Promise<any> {
  const url = `https://api.coinbase.com${path}`;
  // deno-lint-ignore no-explicit-any
  const headers: Record<string, any> = {
    "Content-Type": "application/json",
    "CB-VERSION": "2024-01-01",
  };

  if (auth.type === "oauth") {
    headers["Authorization"] = `Bearer ${auth.accessToken}`;
  } else {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = timestamp + "GET" + path + "";
    const signature = await hmacSign(auth.apiSecret!, message);
    headers["CB-ACCESS-KEY"] = auth.apiKey!;
    headers["CB-ACCESS-SIGN"] = signature;
    headers["CB-ACCESS-TIMESTAMP"] = timestamp;
  }

  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Coinbase API] ${path}: ${response.status} ${errorText.slice(0, 500)}`);
    throw new Error(`Coinbase API ${response.status}: ${path}`);
  }

  return await response.json();
}

// === FORMAT TRADE AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatTransactionAsMemory(tx: any, accountName: string): string {
  const parts = ["Coinbase Trade", ""];
  
  const type = tx.type || "unknown"; // buy, sell, send, receive, trade
  const amount = tx.amount || {};
  const nativeAmount = tx.native_amount || {};
  
  parts.push(`Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`);
  if (accountName) parts.push(`Account: ${accountName}`);
  if (amount.amount && amount.currency) parts.push(`Amount: ${amount.amount} ${amount.currency}`);
  if (nativeAmount.amount && nativeAmount.currency) {
    parts.push(`Value: ${nativeAmount.currency === "USD" ? "$" : ""}${Number(nativeAmount.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${nativeAmount.currency}`);
  }
  if (tx.created_at) parts.push(`Time: ${tx.created_at}`);
  if (tx.id) parts.push(`Transaction ID: ${tx.id}`);
  if (tx.status) parts.push(`Status: ${tx.status}`);
  if (tx.details?.title) parts.push(`Details: ${tx.details.title}`);
  if (tx.details?.subtitle) parts.push(`Note: ${tx.details.subtitle}`);
  
  parts.push("");
  parts.push("A transaction was recorded on Coinbase.");
  return parts.join("\n");
}

// === POLL COINBASE TRADES VIA V2 API ===

async function pollCoinbaseTrades(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching trades for user ${userId}`);

  // Resolve auth credentials
  const auth = await resolveCoinbaseAuth(connectionId);
  if (!auth) {
    throw new Error("Could not resolve Coinbase credentials from Composio. Check that the connection is active and credentials are not masked.");
  }

  // Get current config for cursor
  const { data: currentConfig } = await supabaseClient
    .from("coinbase_trades_config")
    .select("last_trade_timestamp, trades_tracked")
    .eq("user_id", userId)
    .maybeSingle();

  const lastTradeTimestamp = currentConfig?.last_trade_timestamp;
  const isBackfill = !lastTradeTimestamp;
  console.log(`[Coinbase Poll] Mode: ${isBackfill ? "full backfill" : "incremental"}, cursor: ${lastTradeTimestamp || "none"}, auth: ${auth.type}`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let totalNewTrades = 0;
  let latestTimestamp = lastTradeTimestamp;

  // Step 1: List all accounts (wallets)
  // deno-lint-ignore no-explicit-any
  let accounts: any[] = [];
  let nextUri: string | null = "/v2/accounts?limit=100";

  while (nextUri) {
    try {
      const accountsData = await coinbaseApiGet(nextUri, auth);
      const pageAccounts = accountsData.data || [];
      accounts = accounts.concat(pageAccounts);
      nextUri = accountsData.pagination?.next_uri || null;
      console.log(`[Coinbase Poll] Listed ${pageAccounts.length} accounts, next: ${nextUri ? "yes" : "done"}`);
    } catch (err) {
      console.error("[Coinbase Poll] Error listing accounts:", err);
      nextUri = null;
    }
  }

  console.log(`[Coinbase Poll] Found ${accounts.length} accounts total`);

  // Step 2: For each account, fetch transactions (buys, sells, trades, sends, receives)
  for (const account of accounts) {
    const accountId = account.id;
    const accountName = account.name || account.currency?.code || "";

    let txNextUri: string | null = `/v2/accounts/${accountId}/transactions?limit=100&order=desc`;

    while (txNextUri) {
      try {
        const txData = await coinbaseApiGet(txNextUri, auth);
        const transactions = txData.data || [];
        txNextUri = txData.pagination?.next_uri || null;

        console.log(`[Coinbase Poll] Account ${accountName}: ${transactions.length} transactions, next: ${txNextUri ? "yes" : "done"}`);

        if (transactions.length === 0) break;

        // For incremental mode, skip transactions older than cursor
        // deno-lint-ignore no-explicit-any
        const filteredTxs = lastTradeTimestamp
          // deno-lint-ignore no-explicit-any
          ? transactions.filter((tx: any) => tx.created_at && new Date(tx.created_at) > new Date(lastTradeTimestamp))
          : transactions;

        if (filteredTxs.length === 0 && lastTradeTimestamp) {
          // All transactions on this page are older than cursor, stop for this account
          txNextUri = null;
          break;
        }

        // Deduplicate
        // deno-lint-ignore no-explicit-any
        const txIds = filteredTxs.filter((tx: any) => tx.id).map((tx: any) => String(tx.id));

        const { data: existing } = await supabaseClient
          .from("coinbase_processed_trades")
          .select("coinbase_trade_id")
          .eq("user_id", userId)
          .in("coinbase_trade_id", txIds);

        // deno-lint-ignore no-explicit-any
        const existingIds = new Set((existing || []).map((e: any) => e.coinbase_trade_id));
        // deno-lint-ignore no-explicit-any
        const newTxs = filteredTxs.filter((tx: any) => tx.id && !existingIds.has(String(tx.id)));

        for (let i = 0; i < newTxs.length; i++) {
          const tx = newTxs[i];
          const txId = String(tx.id);

          // Insert dedup record
          const { error: insertError } = await supabaseClient
            .from("coinbase_processed_trades")
            .insert({ user_id: userId, coinbase_trade_id: txId });

          if (insertError) {
            if (insertError.code === "23505") continue;
            console.error("[Coinbase Poll] Insert error:", insertError);
            continue;
          }

          // Create memory
          if (apiKeys) {
            const memoryContent = formatTransactionAsMemory(tx, accountName);
            const success = await createMemory(apiKeys, memoryContent);
            if (success) totalNewTrades++;
          }

          // Track latest timestamp
          if (tx.created_at && (!latestTimestamp || new Date(tx.created_at) > new Date(latestTimestamp))) {
            latestTimestamp = tx.created_at;
          }

          // Rate limit: 500ms every 10 writes
          if (i > 0 && i % 10 === 0) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } catch (err) {
        console.error(`[Coinbase Poll] Error fetching transactions for account ${accountName}:`, err);
        txNextUri = null;
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
