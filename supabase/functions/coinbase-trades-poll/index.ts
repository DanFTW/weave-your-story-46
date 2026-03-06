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
  console.log(`[Composio] ${actionName} status=${response.status}, response=${text.slice(0, 500)}`);

  if (!response.ok) {
    throw new Error(`Composio action ${actionName} failed: ${response.status} ${text.slice(0, 200)}`);
  }

  try {
    const parsed = JSON.parse(text);
    // Check if Composio reports the action as unsuccessful
    if (parsed.successful === false || parsed.data?.successful === false) {
      const errMsg = parsed.error || parsed.data?.error || parsed.data?.message || "Unknown Composio error";
      throw new Error(`Composio action ${actionName} unsuccessful: ${errMsg}`);
    }
    // Composio wraps data in various structures
    return parsed.data?.response_data || parsed.response_data || parsed.data || parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return text;
    throw e;
  }
}

// === FORMAT WALLET / TRANSACTION DATA AS MEMORY ===

// deno-lint-ignore no-explicit-any
function formatWalletAsMemory(wallet: any): string {
  const parts = ["Coinbase Wallet", ""];
  if (wallet.name) parts.push(`Name: ${wallet.name}`);
  if (wallet.id) parts.push(`Wallet ID: ${wallet.id}`);

  // Handle balance which could be nested
  const balance = wallet.balance || wallet.default_address?.balance;
  if (balance) {
    if (typeof balance === "object") {
      if (balance.amount && balance.currency) {
        parts.push(`Balance: ${balance.amount} ${balance.currency}`);
      }
    } else {
      parts.push(`Balance: ${balance}`);
    }
  }

  // Handle addresses
  if (wallet.default_address) {
    const addr = wallet.default_address;
    if (addr.address_id) parts.push(`Address: ${addr.address_id}`);
    if (addr.network_id) parts.push(`Network: ${addr.network_id}`);
  }

  parts.push("");
  parts.push("A wallet snapshot was recorded from Coinbase.");
  return parts.join("\n");
}

// === POLL COINBASE WALLETS VIA COMPOSIO TOOL EXECUTION ===

async function pollCoinbaseTrades(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTrades: number; totalTracked: number }> {
  console.log(`[Coinbase Poll] Fetching data for user ${userId}`);

  // Get current config
  const { data: currentConfig } = await supabaseClient
    .from("coinbase_trades_config")
    .select("last_trade_timestamp, trades_tracked")
    .eq("user_id", userId)
    .maybeSingle();

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let totalNewTrades = 0;
  let latestTimestamp = currentConfig?.last_trade_timestamp;

  // Use Composio's COINBASE_LIST_WALLETS action
  try {
    const walletsResult = await executeComposioAction("COINBASE_LIST_WALLETS", connectionId);
    console.log(`[Coinbase Poll] Wallets result type: ${typeof walletsResult}`);

    // Extract wallets array from response
    // deno-lint-ignore no-explicit-any
    let wallets: any[] = [];
    if (Array.isArray(walletsResult)) {
      wallets = walletsResult;
    } else if (walletsResult?.wallets) {
      wallets = walletsResult.wallets;
    } else if (walletsResult?.data) {
      wallets = Array.isArray(walletsResult.data) ? walletsResult.data : [walletsResult.data];
    } else if (typeof walletsResult === "object" && walletsResult !== null) {
      // Try to find any array in the response
      for (const key of Object.keys(walletsResult)) {
        if (Array.isArray(walletsResult[key])) {
          wallets = walletsResult[key];
          break;
        }
      }
    }

    console.log(`[Coinbase Poll] Found ${wallets.length} wallets`);

    for (const wallet of wallets) {
      const walletId = wallet.id || wallet.wallet_id || JSON.stringify(wallet).slice(0, 50);
      const dedupeId = `wallet_${walletId}_${new Date().toISOString().slice(0, 10)}`;

      // Check if already processed today
      const { data: existing } = await supabaseClient
        .from("coinbase_processed_trades")
        .select("coinbase_trade_id")
        .eq("user_id", userId)
        .eq("coinbase_trade_id", dedupeId)
        .maybeSingle();

      if (existing) continue;

      // Insert dedup record
      const { error: insertError } = await supabaseClient
        .from("coinbase_processed_trades")
        .insert({ user_id: userId, coinbase_trade_id: dedupeId });

      if (insertError) {
        if (insertError.code === "23505") continue;
        console.error("[Coinbase Poll] Insert error:", insertError);
        continue;
      }

      // Create memory
      if (apiKeys) {
        const memoryContent = formatWalletAsMemory(wallet);
        const success = await createMemory(apiKeys, memoryContent);
        if (success) totalNewTrades++;
      }

      latestTimestamp = new Date().toISOString();
    }
  } catch (err) {
    console.error("[Coinbase Poll] Error with COINBASE_LIST_WALLETS:", err);

    // Fallback: try to get basic account info
    try {
      const userResult = await executeComposioAction("COINBASE_GET_CURRENT_USER", connectionId);
      console.log(`[Coinbase Poll] User result:`, JSON.stringify(userResult).slice(0, 500));

      if (userResult && apiKeys) {
        const dedupeId = `user_snapshot_${new Date().toISOString().slice(0, 10)}`;

        const { data: existing } = await supabaseClient
          .from("coinbase_processed_trades")
          .select("coinbase_trade_id")
          .eq("user_id", userId)
          .eq("coinbase_trade_id", dedupeId)
          .maybeSingle();

        if (!existing) {
          await supabaseClient
            .from("coinbase_processed_trades")
            .insert({ user_id: userId, coinbase_trade_id: dedupeId });

          const parts = ["Coinbase Account Snapshot", ""];
          const userData = userResult.data || userResult;
          if (userData.name) parts.push(`Name: ${userData.name}`);
          if (userData.email) parts.push(`Email: ${userData.email}`);
          if (userData.username) parts.push(`Username: ${userData.username}`);
          if (userData.country?.name) parts.push(`Country: ${userData.country.name}`);
          if (userData.native_currency) parts.push(`Currency: ${userData.native_currency}`);
          parts.push(`Snapshot Date: ${new Date().toISOString()}`);
          parts.push("");
          parts.push("A Coinbase account snapshot was recorded.");

          const success = await createMemory(apiKeys, parts.join("\n"));
          if (success) totalNewTrades++;
          latestTimestamp = new Date().toISOString();
        }
      }
    } catch (fallbackErr) {
      console.error("[Coinbase Poll] Fallback also failed:", fallbackErr);
      throw new Error("Could not fetch Coinbase data. Both COINBASE_LIST_WALLETS and COINBASE_GET_CURRENT_USER failed.");
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
