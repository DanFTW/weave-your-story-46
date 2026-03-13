import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

async function createSlackMemory(apiKey: string, privateKeyPem: string, userKey: string, content: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const privateKey = await importPrivateKey(privateKeyPem);
    const reqBody = { userKey, content };
    const signature = await signRequest(privateKey, reqBody);
    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apiKey": apiKey, "signature": signature },
      body: JSON.stringify(reqBody),
    });
    const respText = await response.text();
    return { ok: response.ok, status: response.status, body: respText };
  } catch (error) {
    console.error("[Slack] Error creating memory:", error);
    return { ok: false, status: 0, body: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { action, query } = await req.json();

    // Get the Slack user token from Supabase secrets
    const slackToken = Deno.env.get("SLACK_USER_TOKEN");

    if (!slackToken) {
      const missingTokenPayload = {
        error: "Slack not connected",
        code: "SLACK_TOKEN_MISSING",
        needsReconnect: true,
      };

      if (action === "list-channels") {
        return new Response(JSON.stringify(missingTokenPayload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(missingTokenPayload), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function slackApi(method: string, params: Record<string, any> = {}) {
      const url = new URL(`https://slack.com/api/${method}`);
      const getParams = ["conversations.list", "conversations.history", "users.list"];

      let result;
      if (getParams.includes(method)) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${slackToken}` },
        });
        result = await resp.json();
      } else {
        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
        });
        result = await resp.json();
      }

      if (!result.ok) {
        console.error(`Slack API error in ${method}:`, JSON.stringify(result));
      }

      return result;
    }

    if (action === "list-channels") {
      const result = await slackApi("conversations.list", {
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 200,
      });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error || "Failed to list channels" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channels = (result.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isMember: ch.is_member ?? false,
        isPrivate: ch.is_private ?? false,
        numMembers: ch.num_members,
      }));

      return new Response(JSON.stringify({ channels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "activate") {
      await adminClient
        .from("slack_messages_config")
        .update({ is_active: true })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      await adminClient
        .from("slack_messages_config")
        .update({ is_active: false })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "poll") {
      const { data: configData } = await adminClient
        .from("slack_messages_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!configData) {
        return new Response(JSON.stringify({ error: "No config found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channelId = (configData.selected_channel_ids || [])[0];
      if (!channelId) {
        return new Response(JSON.stringify({ error: "No channel selected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const liamApiKey = Deno.env.get("LIAM_API_KEY");
      const liamUserKey = Deno.env.get("LIAM_USER_KEY");
      const liamPrivateKey = Deno.env.get("LIAM_PRIVATE_KEY");

      if (!liamApiKey || !liamUserKey || !liamPrivateKey) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalImported = 0;

      try {
        const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

        const historyResult = await slackApi("conversations.history", {
          channel: channelId,
          limit: 200,
          oldest: String(thirtyDaysAgo),
        });

        if (historyResult.ok) {
          const allMessages = historyResult.messages || [];
          const nonSubtypeMessages = allMessages.filter((m: any) => !m.subtype);
          console.log(`[poll] conversations.history returned ${allMessages.length} total messages, ${nonSubtypeMessages.length} without subtype`);

          let skippedCount = 0;

          for (const msg of allMessages) {
            if (msg.subtype) continue;

            const messageId = `${channelId}_${msg.ts}`;

            const { data: existing } = await adminClient
              .from("slack_processed_messages")
              .select("id")
              .eq("user_id", user.id)
              .eq("slack_message_id", messageId)
              .maybeSingle();

            if (existing) {
              skippedCount++;
              continue;
            }

            const memoryContent = `Slack message from ${msg.user || "unknown"}: ${msg.text}`;

            console.log(`[poll] Sending to LIAM API:`, JSON.stringify({ content: memoryContent }));

            const liamResult = await createSlackMemory(liamApiKey, liamPrivateKey, liamUserKey, memoryContent);
            console.log(`[poll] LIAM API response status=${liamResult.status} body=${liamResult.body}`);

            if (liamResult.ok) {
              await adminClient.from("slack_processed_messages").insert({
                user_id: user.id,
                slack_message_id: messageId,
              });
              totalImported++;
            }
          }

          console.log(`[poll] Skipped ${skippedCount} already-processed messages, imported ${totalImported} new messages`);
        }
      } catch (err) {
        console.error(`Failed to fetch history for channel ${channelId}:`, err);
      }

      await adminClient
        .from("slack_messages_config")
        .update({
          messages_imported: (configData.messages_imported || 0) + totalImported,
          last_polled_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, messagesImported: totalImported }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search") {
      if (!query) {
        return new Response(JSON.stringify({ error: "Query required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: configData } = await adminClient
        .from("slack_messages_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!configData) {
        return new Response(JSON.stringify({ error: "No config found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channelId = (configData.selected_channel_ids || [])[0];
      const channelName = (configData.selected_workspace_ids || [])[0];
      const searchQuery = channelName ? `in:#${channelName} ${query}` : query;

      const liamApiKey = Deno.env.get("LIAM_API_KEY");
      const liamUserKey = Deno.env.get("LIAM_USER_KEY");
      const liamPrivateKey = Deno.env.get("LIAM_PRIVATE_KEY");

      if (!liamApiKey || !liamUserKey || !liamPrivateKey) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let totalImported = 0;

      const searchResult = await slackApi("search.all", {
        query: searchQuery,
        count: 50,
        sort: "timestamp",
        sort_dir: "desc",
      });

      if (searchResult.ok && searchResult.messages?.matches) {
        for (const msg of searchResult.messages.matches) {
          const messageId = `${msg.channel?.id || "unknown"}_${msg.ts}`;

          const { data: existing } = await adminClient
            .from("slack_processed_messages")
            .select("id")
            .eq("user_id", user.id)
            .eq("slack_message_id", messageId)
            .maybeSingle();

          if (existing) continue;

          const memoryContent = `Slack message from ${msg.username || "unknown"} in #${msg.channel?.name || "unknown"}: ${msg.text}`;

          const liamResult = await createSlackMemory(liamApiKey, liamPrivateKey, liamUserKey, memoryContent);

          if (liamResult.ok) {
            await adminClient.from("slack_processed_messages").insert({
              user_id: user.id,
              slack_message_id: messageId,
            });
            totalImported++;
          }
        }
      }

      return new Response(JSON.stringify({ success: true, messagesImported: totalImported }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("slack-messages-sync error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
