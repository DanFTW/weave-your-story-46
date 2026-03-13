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

// === SLACK USER RESOLUTION ===

async function fetchUserMap(slackToken: string): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "200" });
    if (cursor) params.set("cursor", cursor);
    const resp = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const result = await resp.json();
    if (!result.ok) {
      console.error("users.list error:", result.error);
      break;
    }
    for (const member of result.members || []) {
      const displayName =
        member.profile?.display_name ||
        member.profile?.real_name ||
        member.real_name ||
        member.name ||
        member.id;
      userMap.set(member.id, displayName);
    }
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return userMap;
}

function resolveUserName(userMap: Map<string, string>, userId: string): string {
  return userMap.get(userId) || userId;
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
      const getParams = ["conversations.list", "conversations.history", "users.list", "team.info"];

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

    // === LIST WORKSPACE ===
    if (action === "list-workspace") {
      const result = await slackApi("team.info");
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error || "Failed to fetch workspace" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const team = result.team;
      return new Response(JSON.stringify({
        workspace: {
          id: team.id,
          name: team.name,
          icon: team.icon?.image_132 || team.icon?.image_88 || null,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LIST CHANNELS (including DMs) ===
    if (action === "list-channels") {
      // Fetch user map for resolving DM partner names
      const userMap = await fetchUserMap(slackToken!);

      const result = await slackApi("conversations.list", {
        types: "public_channel,private_channel,im,mpim",
        exclude_archived: true,
        limit: 200,
      });

      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error || "Failed to list channels" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const channels = (result.channels || []).map((ch: any) => {
        const isIm = ch.is_im === true;
        const isMpim = ch.is_mpim === true;
        const isDm = isIm || isMpim;

        let name = ch.name || ch.id;
        if (isIm) {
          // For 1:1 DMs, resolve the partner's display name
          name = resolveUserName(userMap, ch.user);
        } else if (isMpim) {
          // For group DMs, use the purpose or name_normalized
          name = ch.purpose?.value || ch.name_normalized || ch.name || ch.id;
        }

        return {
          id: ch.id,
          name,
          isMember: ch.is_member ?? (isDm ? true : false),
          isPrivate: ch.is_private ?? isDm,
          isDm,
          numMembers: isDm ? undefined : ch.num_members,
        };
      });

      return new Response(JSON.stringify({ channels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ACTIVATE / DEACTIVATE ===
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

    // === POLL ===
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

      const channelIds: string[] = configData.selected_channel_ids || [];
      if (channelIds.length === 0) {
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

      // Build user map once for resolving all author names
      const userMap = await fetchUserMap(slackToken!);

      let totalImported = 0;
      let totalBackfilled = 0;
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

      for (const channelId of channelIds) {
        try {
          const historyResult = await slackApi("conversations.history", {
            channel: channelId,
            limit: 200,
            oldest: String(thirtyDaysAgo),
          });

          if (historyResult.ok) {
            const allMessages = historyResult.messages || [];
            console.log(`[poll] Channel ${channelId}: ${allMessages.length} messages`);

            for (const msg of allMessages) {
              if (msg.subtype) continue;

              const messageId = `${channelId}_${msg.ts}`;
              const resolvedAuthor = resolveUserName(userMap, msg.user || "unknown");

              const { data: existing } = await adminClient
                .from("slack_processed_messages")
                .select("id")
                .eq("user_id", user.id)
                .eq("slack_message_id", messageId)
                .maybeSingle();

              if (existing) continue;

              const memoryContent = `Slack message from ${resolvedAuthor}: ${msg.text}`;
              const liamResult = await createSlackMemory(liamApiKey, liamPrivateKey, liamUserKey, memoryContent);

              if (liamResult.ok) {
                await adminClient.from("slack_processed_messages").insert({
                  user_id: user.id,
                  slack_message_id: messageId,
                  message_content: (msg.text || "").substring(0, 500),
                  author_name: resolvedAuthor,
                });
                totalImported++;
              }
            }

            // Backfill: update existing rows that have null content or raw user IDs
            for (const msg of allMessages) {
              if (msg.subtype) continue;
              const messageId = `${channelId}_${msg.ts}`;
              const resolvedAuthor = resolveUserName(userMap, msg.user || "unknown");

              // Backfill null content
              const { data: updatedNull } = await adminClient
                .from("slack_processed_messages")
                .update({
                  message_content: (msg.text || "").substring(0, 500),
                  author_name: resolvedAuthor,
                })
                .eq("user_id", user.id)
                .eq("slack_message_id", messageId)
                .is("message_content", null)
                .select("id");
              if (updatedNull && updatedNull.length > 0) totalBackfilled += updatedNull.length;

              // Backfill raw user IDs (starts with "U" and looks like a Slack ID)
              const { data: updatedRawId } = await adminClient
                .from("slack_processed_messages")
                .update({ author_name: resolvedAuthor })
                .eq("user_id", user.id)
                .eq("slack_message_id", messageId)
                .eq("author_name", msg.user || "unknown")
                .neq("author_name", resolvedAuthor)
                .select("id");
              if (updatedRawId && updatedRawId.length > 0) totalBackfilled += updatedRawId.length;
            }
          }
        } catch (err) {
          console.error(`Failed to fetch history for channel ${channelId}:`, err);
        }
      }

      await adminClient
        .from("slack_messages_config")
        .update({
          messages_imported: (configData.messages_imported || 0) + totalImported,
          last_polled_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, messagesImported: totalImported, backfilled: totalBackfilled }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SEARCH ===
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

      // Build user map for resolving author names in search results
      const userMap = await fetchUserMap(slackToken!);

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

          const resolvedAuthor = msg.username || resolveUserName(userMap, msg.user || "unknown");
          const memoryContent = `Slack message from ${resolvedAuthor} in #${msg.channel?.name || "unknown"}: ${msg.text}`;

          const liamResult = await createSlackMemory(liamApiKey, liamPrivateKey, liamUserKey, memoryContent);

          if (liamResult.ok) {
            await adminClient.from("slack_processed_messages").insert({
              user_id: user.id,
              slack_message_id: messageId,
              message_content: (msg.text || "").substring(0, 500),
              author_name: resolvedAuthor,
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
