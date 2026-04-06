import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

// ── Helpers ──

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ── LIAM signing helpers ──

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContent = pemKey
    .replace(/-----BEGIN (EC )?PRIVATE KEY-----/g, "")
    .replace(/-----END (EC )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function toDER(signature: Uint8Array): string {
  const r = signature.slice(0, 32);
  const s = signature.slice(32, 64);
  const formatInt = (arr: Uint8Array): number[] => {
    const result: number[] = [];
    let i = 0;
    while (i < arr.length - 1 && arr[i] === 0) i++;
    if (arr[i] >= 0x80) result.push(0);
    for (; i < arr.length; i++) result.push(arr[i]);
    return result;
  };
  const rFormatted = formatInt(r);
  const sFormatted = formatInt(s);
  const sequence = [0x02, rFormatted.length, ...rFormatted, 0x02, sFormatted.length, ...sFormatted];
  const der = new Uint8Array([0x30, sequence.length, ...sequence]);
  return btoa(String.fromCharCode(...der));
}

async function signRequest(privateKey: CryptoKey, body: object): Promise<string> {
  const bodyStr = JSON.stringify(body);
  const data = new TextEncoder().encode(bodyStr);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );
  return toDER(new Uint8Array(signature));
}

// ── Composio execute helper ──

async function composioExecute(
  action: string,
  connectionId: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`[SpotifyFinder] composioExecute: action=${action}`);
  const res = await fetch(
    `https://backend.composio.dev/api/v3/tools/execute/${action}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: args,
      }),
    }
  );
  const raw = await res.text();
  console.log(`[SpotifyFinder] composioExecute ${action} status=${res.status} raw(500):`, raw.slice(0, 500));

  if (!res.ok) {
    console.error(`[SpotifyFinder] Composio ${action} HTTP error ${res.status}:`, raw.slice(0, 300));
    throw new Error(`Composio ${action} failed: ${res.status}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Composio ${action} returned non-JSON response`);
  }

  // Detect provider-level failures inside 200 responses
  const topKeys = Object.keys(parsed || {});
  console.log(`[SpotifyFinder] composioExecute ${action} topKeys:`, topKeys);

  if (parsed?.successful === false || parsed?.data?.successful === false) {
    const errMsg = parsed?.error || parsed?.data?.error || parsed?.message || "Provider returned unsuccessful";
    console.error(`[SpotifyFinder] Composio ${action} provider failure:`, errMsg);
    throw new Error(`Composio ${action} provider failure: ${errMsg}`);
  }
  if (parsed?.error || parsed?.data?.error) {
    const errMsg = parsed?.error || parsed?.data?.error;
    console.error(`[SpotifyFinder] Composio ${action} error in payload:`, errMsg);
    throw new Error(`Composio ${action} error: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`);
  }

  return parsed;
}

// ── Robust data extractor for nested Composio v3 responses ──

function extractComposioData(result: any, label: string): any {
  const candidates = [
    result?.data?.response_data?.data,
    result?.data?.response_data,
    result?.response_data?.data,
    result?.response_data,
    result?.data?.data,
    result?.data,
    result,
  ];
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i] && typeof candidates[i] === "object") {
      console.log(`[SpotifyFinder] ${label}: matched candidate index ${i}, keys:`, Object.keys(candidates[i]).slice(0, 10));
      return candidates[i];
    }
  }
  console.warn(`[SpotifyFinder] ${label}: no candidate matched, returning result as-is`);
  return result;
}

// ── LIAM helpers ──

async function fetchMemories(userId: string, sb: any): Promise<{ id: string; content: string }[]> {
  const { data: apiKeys } = await sb
    .from("user_api_keys")
    .select("api_key, private_key, user_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.error("[SpotifyFinder] No LIAM API keys for user");
    return [];
  }

  const privateKey = await importPrivateKey(apiKeys.private_key);
  const listBody = { userKey: apiKeys.user_key };
  const signature = await signRequest(privateKey, listBody);

  const listRes = await fetch(`${LIAM_API_BASE}/memory/list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: apiKeys.api_key,
      signature,
    },
    body: JSON.stringify(listBody),
  });

  if (!listRes.ok) {
    console.error("[SpotifyFinder] LIAM list error:", listRes.status);
    return [];
  }

  const listJson = await listRes.json();
  let rawMemories: any[] = [];
  if (Array.isArray(listJson)) rawMemories = listJson;
  else if (Array.isArray(listJson?.data)) rawMemories = listJson.data;
  else if (Array.isArray(listJson?.data?.memories)) rawMemories = listJson.data.memories;
  else if (listJson?.data && typeof listJson.data === "object") {
    for (const key of Object.keys(listJson.data)) {
      if (Array.isArray(listJson.data[key])) {
        rawMemories = listJson.data[key];
        break;
      }
    }
  }

  return rawMemories
    .slice(0, 50)
    .map((m: any) => ({
      id: m.transactionNumber || m.id || String(Math.random()),
      content: m.memory || m.content || "",
    }))
    .filter((m: any) => m.content);
}

async function writeMemory(
  userId: string,
  content: string,
  tag: string,
  sb: any
): Promise<boolean> {
  const { data: apiKeys } = await sb
    .from("user_api_keys")
    .select("api_key, private_key, user_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) return false;

  const privateKey = await importPrivateKey(apiKeys.private_key);
  const requestBody = { userKey: apiKeys.user_key, content, tag };
  const signature = await signRequest(privateKey, requestBody);

  const res = await fetch(`${LIAM_API_BASE}/memory/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apiKey: apiKeys.api_key,
      signature,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    console.error("[SpotifyFinder] LIAM create error:", res.status, await res.text());
    return false;
  }
  return true;
}

// ── AI query generation ──

async function generateSearchQuery(memories: { content: string }[]): Promise<string | null> {
  try {
    const recentText = memories
      .slice(0, 20)
      .map((m) => m.content)
      .join("\n---\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a music discovery assistant. Given a user's recent memories/journal entries, generate a Spotify search query that would find a song matching their current mood, themes, and life context. Return ONLY the search query string, nothing else. The query should be 3-8 words — a mix of mood, genre, and theme. Examples: "upbeat indie road trip", "calm piano reflective evening", "energetic pop celebration". Do NOT return song titles or artist names.`,
          },
          {
            role: "user",
            content: `Here are my recent memories:\n\n${recentText}\n\nGenerate a Spotify search query that matches the mood and themes of these memories.`,
          },
        ],
        max_tokens: 50,
        temperature: 0.8,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[SpotifyFinder] AI error:", res.status);
      return null;
    }

    const json = await res.json();
    const query = json?.choices?.[0]?.message?.content?.trim();
    console.log("[SpotifyFinder] Generated search query:", query);
    return query || null;
  } catch (e) {
    console.error("[SpotifyFinder] AI error:", e);
    return null;
  }
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ...params } = body;

    // Cron auth
    const isCron = req.headers.get("x-cron-trigger") === "supabase-internal";
    let userId: string | null = null;

    if (isCron) {
      const cronSecret = req.headers.get("x-cron-secret");
      if (cronSecret !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: "Invalid cron secret" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = getUserId(req);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const sb = adminClient();

    // ── LIST-PLAYLISTS ──
    if (action === "list-playlists") {
      console.log(`[SpotifyFinder] list-playlists: userId=${userId}`);
      const { data: integration } = await sb
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId!)
        .eq("integration_id", "spotify")
        .eq("status", "connected")
        .maybeSingle();

      console.log(`[SpotifyFinder] list-playlists: connectionId=${integration?.composio_connection_id || "NONE"}`);

      if (!integration?.composio_connection_id) {
        return new Response(JSON.stringify({ error: "Spotify not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allPlaylists: any[] = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const result = await composioExecute(
          "SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS",
          integration.composio_connection_id,
          { limit, offset }
        );

        const data = extractComposioData(result, "list-playlists");
        const items = data?.items || [];
        console.log(`[SpotifyFinder] list-playlists offset=${offset}: ${items.length} items found`);

        if (items.length === 0 && offset === 0) {
          // Log full response for debugging first page with no items
          console.warn(`[SpotifyFinder] list-playlists: 0 items on first page. Full response(1000):`, JSON.stringify(result).slice(0, 1000));
        }

        for (const item of items) {
          allPlaylists.push({
            id: item.id,
            name: item.name,
            imageUrl: item.images?.[0]?.url || null,
            trackCount: item.tracks?.total ?? 0,
          });
        }

        hasMore = items.length === limit;
        offset += limit;

        if (offset > 500) break;
      }

      console.log(`[SpotifyFinder] list-playlists: total=${allPlaylists.length}`);

      return new Response(JSON.stringify({ playlists: allPlaylists }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTIVATE ──
    if (action === "activate") {
      const { playlistId, playlistName, frequency } = params;

      await sb
        .from("spotify_music_finder_config")
        .update({
          is_active: true,
          playlist_id: playlistId,
          playlist_name: playlistName,
          frequency: frequency || "daily",
        })
        .eq("user_id", userId!);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb
        .from("spotify_music_finder_config")
        .update({ is_active: false })
        .eq("user_id", userId!);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANUAL-POLL / CRON-POLL ──
    if (action === "manual-poll" || action === "cron-poll") {
      // For cron, process all active users
      let usersToProcess: { userId: string; playlistId: string; frequency: string }[] = [];

      if (isCron) {
        const { data: configs } = await sb
          .from("spotify_music_finder_config")
          .select("user_id, playlist_id, frequency, last_polled_at")
          .eq("is_active", true)
          .not("playlist_id", "is", null);

        if (!configs || configs.length === 0) {
          return new Response(JSON.stringify({ skipped: true, reason: "no_active_users" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const now = new Date();
        for (const cfg of configs) {
          // Daily: run every day; Weekly: run if 7+ days since last poll
          if (cfg.frequency === "weekly" && cfg.last_polled_at) {
            const lastPoll = new Date(cfg.last_polled_at);
            const daysSince = (now.getTime() - lastPoll.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 6.5) continue;
          }
          usersToProcess.push({
            userId: cfg.user_id,
            playlistId: cfg.playlist_id,
            frequency: cfg.frequency,
          });
        }
      } else {
        // Manual poll for single user
        const { data: cfg } = await sb
          .from("spotify_music_finder_config")
          .select("playlist_id, frequency")
          .eq("user_id", userId!)
          .eq("is_active", true)
          .maybeSingle();

        if (!cfg?.playlist_id) {
          return new Response(JSON.stringify({ skipped: true, reason: "not_active" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        usersToProcess = [{ userId: userId!, playlistId: cfg.playlist_id, frequency: cfg.frequency }];
      }

      // Process each user
      let lastResult: any = { skipped: true, reason: "no_users" };

      for (const user of usersToProcess) {
        try {
          lastResult = await processUserDiscovery(user.userId, user.playlistId, sb);
        } catch (e) {
          console.error(`[SpotifyFinder] Error for user ${user.userId}:`, e);
          lastResult = { skipped: true, reason: "error" };
        }
      }

      return new Response(JSON.stringify(isCron ? { processed: usersToProcess.length } : lastResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[SpotifyFinder] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Core discovery logic ──

async function processUserDiscovery(
  userId: string,
  playlistId: string,
  sb: any
): Promise<any> {
  // 1. Get Spotify connection
  const { data: integration } = await sb
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "spotify")
    .eq("status", "connected")
    .maybeSingle();

  if (!integration?.composio_connection_id) {
    return { skipped: true, reason: "spotify_not_connected" };
  }

  const connectionId = integration.composio_connection_id;

  // 2. Fetch recent memories
  const memories = await fetchMemories(userId, sb);
  if (memories.length === 0) {
    return { skipped: true, reason: "no_memories" };
  }

  // 3. Filter out SPOTIFY-tagged memories (these are previously added songs)
  const spotifyMemories = memories.filter(
    (m) => m.content.startsWith("[SPOTIFY MUSIC FINDER]")
  );
  const previousSongs = spotifyMemories
    .map((m) => {
      const match = m.content.match(/"([^"]+)" by ([^.]+)/);
      return match ? `${match[1]} - ${match[2]}`.toLowerCase() : "";
    })
    .filter(Boolean);

  // Use non-spotify memories for mood analysis
  const contextMemories = memories.filter(
    (m) => !m.content.startsWith("[SPOTIFY MUSIC FINDER]")
  );

  if (contextMemories.length === 0) {
    return { skipped: true, reason: "no_context_memories" };
  }

  // 4. Generate search query via LLM
  let searchQuery = await generateSearchQuery(contextMemories);
  if (!searchQuery) {
    return { skipped: true, reason: "ai_failed" };
  }

  // 5. Search Spotify
  let tracks: any[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const searchResult = await composioExecute(
        "SPOTIFY_SEARCH_FOR_ITEM",
        connectionId,
        { q: searchQuery, type: "track", limit: 10 }
      );

      const data = extractComposioData(searchResult, "search");
      tracks = data?.tracks?.items || [];
      console.log(`[SpotifyFinder] Search: ${tracks.length} tracks found`);

      if (tracks.length > 0) break;

      // Simplify query for retry
      const words = searchQuery.split(" ");
      searchQuery = words.slice(0, Math.max(2, Math.floor(words.length / 2))).join(" ");
      console.log(`[SpotifyFinder] No results, retrying with: "${searchQuery}"`);
    } catch (e) {
      console.error("[SpotifyFinder] Search error:", e);
      break;
    }
  }

  if (tracks.length === 0) {
    return { skipped: true, reason: "no_search_results" };
  }

  // 6. Check playlist for existing tracks
  let existingTrackUris = new Set<string>();
  try {
    const playlistResult = await composioExecute(
      "SPOTIFY_GET_PLAYLIST_ITEMS",
      connectionId,
      { playlist_id: playlistId, limit: 100 }
    );
    const playlistData = extractComposioData(playlistResult, "playlist-items");
    const playlistItems = playlistData?.items || [];
    console.log(`[SpotifyFinder] Existing playlist tracks: ${playlistItems.length}`);
    for (const item of playlistItems) {
      if (item?.track?.uri) {
        existingTrackUris.add(item.track.uri);
      }
    }
  } catch (e) {
    console.warn("[SpotifyFinder] Could not check existing playlist tracks:", e);
  }

  // 7. Pick best track (not already added)
  let selectedTrack: any = null;
  for (const track of tracks) {
    if (!track?.uri || !track?.name) continue;

    const trackKey = `${track.name} - ${track.artists?.[0]?.name || ""}`.toLowerCase();
    if (previousSongs.includes(trackKey)) continue;
    if (existingTrackUris.has(track.uri)) continue;

    selectedTrack = track;
    break;
  }

  if (!selectedTrack) {
    return { skipped: true, reason: "all_tracks_already_added" };
  }

  // 8. Add to playlist
  try {
    await composioExecute(
      "SPOTIFY_ADD_ITEMS_TO_PLAYLIST",
      connectionId,
      { playlist_id: playlistId, uris: selectedTrack.uri }
    );
  } catch (e) {
    console.error("[SpotifyFinder] Add to playlist error:", e);
    return { skipped: true, reason: "add_to_playlist_failed" };
  }

  const trackName = selectedTrack.name;
  const trackArtist = selectedTrack.artists?.[0]?.name || "Unknown Artist";
  console.log(`[SpotifyFinder] Added: "${trackName}" by ${trackArtist}`);

  // 9. Write memory back to LIAM
  const memoryContent = `[SPOTIFY MUSIC FINDER] Added "${trackName}" by ${trackArtist} to Spotify playlist. Search query: "${searchQuery}". Discovered based on recent memory themes.`;
  await writeMemory(userId, memoryContent, "SPOTIFY", sb);

  // 10. Update config
  const { data: currentCfg } = await sb
    .from("spotify_music_finder_config")
    .select("songs_added")
    .eq("user_id", userId)
    .single();

  await sb
    .from("spotify_music_finder_config")
    .update({
      songs_added: ((currentCfg as any)?.songs_added ?? 0) + 1,
      last_polled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return {
    added: true,
    trackName,
    trackArtist,
    trackUri: selectedTrack.uri,
  };
}
