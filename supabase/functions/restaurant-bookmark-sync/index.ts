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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

// ── AI Restaurant Parsing ──

interface ParsedRestaurant {
  isRestaurant: boolean;
  name: string | null;
  address: string | null;
  cuisine: string | null;
  notes: string | null;
  isComplete: boolean;
}

async function parseMemoryForRestaurant(content: string): Promise<ParsedRestaurant> {
  if (!LOVABLE_API_KEY) {
    console.error("[RestaurantSync] LOVABLE_API_KEY not configured");
    return { isRestaurant: false, name: null, address: null, cuisine: null, notes: null, isComplete: false };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

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
            content: "You extract restaurant information from text. Only detect real restaurant/dining establishment mentions (specific restaurant names, not generic food references). A restaurant must have a recognizable name.",
          },
          {
            role: "user",
            content: `Extract restaurant information from this text. If no specific restaurant is mentioned, set isRestaurant to false.\n\nText: "${content}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_restaurant",
              description: "Extract restaurant details from text",
              parameters: {
                type: "object",
                properties: {
                  isRestaurant: { type: "boolean", description: "Whether the text mentions a specific restaurant" },
                  name: { type: "string", description: "Restaurant name, null if not a restaurant" },
                  address: { type: "string", description: "Restaurant address or location, null if unknown" },
                  cuisine: { type: "string", description: "Type of cuisine (e.g. Italian, Japanese), null if unknown" },
                  notes: { type: "string", description: "Any additional context about the restaurant" },
                  isComplete: { type: "boolean", description: "True if both name and address are present" },
                },
                required: ["isRestaurant", "name", "address", "cuisine", "notes", "isComplete"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_restaurant" } },
      }),
    });

    clearTimeout(timeout);
    console.log(`[RestaurantSync] AI response status: ${res.status}`);

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("[RestaurantSync] AI rate limited");
      } else if (res.status === 402) {
        console.warn("[RestaurantSync] AI payment required");
      } else {
        console.error("[RestaurantSync] AI error:", res.status, await res.text());
      }
      return { isRestaurant: false, name: null, address: null, cuisine: null, notes: null, isComplete: false };
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return { isRestaurant: false, name: null, address: null, cuisine: null, notes: null, isComplete: false };
  } catch (e) {
    console.error("[RestaurantSync] Parse error:", e);
    return { isRestaurant: false, name: null, address: null, cuisine: null, notes: null, isComplete: false };
  }
}

// ── Find place via Composio Google Maps ──

interface PlaceResult {
  found: boolean;
  placeId: string | null;
  googleMapsUrl: string | null;
}

async function findOnGoogleMaps(
  connectionId: string,
  name: string,
  address: string,
): Promise<PlaceResult> {
  try {
    console.log(`[RestaurantSync] Searching Google Maps for: "${name}" at "${address}"`);

    const searchQuery = `${name} ${address}`.trim();
    const searchRes = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLE_MAPS_TEXT_SEARCH",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: { textQuery: searchQuery },
        }),
      }
    );

    const searchRaw = await searchRes.text();
    if (!searchRes.ok) {
      console.error(`[RestaurantSync] Composio search error ${searchRes.status}:`, searchRaw);
      return { found: false, placeId: null, googleMapsUrl: null };
    }

    console.log("[RestaurantSync] Search result:", searchRaw.substring(0, 300));

    // Extract place_id from search results
    try {
      const searchData = JSON.parse(searchRaw);
      const responseData = searchData?.response_data ?? searchData?.data ?? searchData;
      const places = responseData?.places ?? responseData?.results ?? [];
      const firstPlace = Array.isArray(places) ? places[0] : null;

      if (firstPlace) {
        const placeId = firstPlace.id ?? firstPlace.place_id ?? firstPlace.placeId ?? null;
        const placeName = firstPlace.displayName?.text ?? firstPlace.name ?? name;
        if (placeId) {
          const googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
          console.log(`[RestaurantSync] Found place: ${placeName} (${placeId})`);
          return { found: true, placeId, googleMapsUrl };
        }
      }

      // Fallback: generate a search URL even without place_id
      const fallbackUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      console.log(`[RestaurantSync] No place_id found, using search URL fallback`);
      return { found: true, placeId: null, googleMapsUrl: fallbackUrl };
    } catch (parseErr) {
      console.warn("[RestaurantSync] Could not parse search response:", parseErr);
      const fallbackUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      return { found: true, placeId: null, googleMapsUrl: fallbackUrl };
    }
  } catch (e) {
    console.error("[RestaurantSync] Search error:", e);
    return { found: false, placeId: null, googleMapsUrl: null };
  }
}

// ── Main Handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    const userId = getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = adminClient();

    // ── ACTIVATE ──
    if (action === "activate") {
      await sb
        .from("restaurant_bookmark_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb
        .from("restaurant_bookmark_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PROCESS-NEW-MEMORY ──
    if (action === "process-new-memory") {
      const { content, memoryId } = params;
      if (!content || !memoryId) {
        return new Response(JSON.stringify({ error: "Missing content or memoryId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if sync is active
      const { data: cfg } = await sb
        .from("restaurant_bookmark_config")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cfg?.is_active) {
        return new Response(JSON.stringify({ skipped: true, reason: "sync_inactive" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse
      const parsed = await parseMemoryForRestaurant(content);
      if (!parsed.isRestaurant) {
        return new Response(JSON.stringify({ skipped: true, reason: "not_restaurant" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (parsed.isComplete && parsed.name && parsed.address) {
        // Get Google Maps connection
        const { data: integration } = await sb
          .from("user_integrations")
          .select("composio_connection_id")
          .eq("user_id", userId)
          .eq("integration_id", "googlemaps")
          .eq("status", "connected")
          .maybeSingle();

        if (integration?.composio_connection_id) {
          const success = await bookmarkOnGoogleMaps(
            integration.composio_connection_id,
            parsed.name,
            parsed.address,
            parsed.cuisine,
            parsed.notes
          );

          if (success) {
            await sb.from("pending_restaurant_bookmarks").upsert({
              user_id: userId,
              memory_id: memoryId,
              memory_content: content,
              restaurant_name: parsed.name,
              restaurant_address: parsed.address,
              restaurant_cuisine: parsed.cuisine,
              restaurant_notes: parsed.notes,
              status: "completed",
            }, { onConflict: "user_id,memory_id" });

            // Increment counter
            const { data: currentCfg } = await sb
              .from("restaurant_bookmark_config")
              .select("restaurants_bookmarked")
              .eq("user_id", userId)
              .single();

            await sb
              .from("restaurant_bookmark_config")
              .update({ restaurants_bookmarked: ((currentCfg as any)?.restaurants_bookmarked ?? 0) + 1 })
              .eq("user_id", userId);

            return new Response(JSON.stringify({ bookmarked: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Incomplete or failed — queue it
      await sb.from("pending_restaurant_bookmarks").upsert({
        user_id: userId,
        memory_id: memoryId,
        memory_content: content,
        restaurant_name: parsed.name,
        restaurant_address: parsed.address,
        restaurant_cuisine: parsed.cuisine,
        restaurant_notes: parsed.notes,
        status: "pending",
      }, { onConflict: "user_id,memory_id" });

      return new Response(JSON.stringify({ queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE-BOOKMARK (from pending queue) ──
    if (action === "create-bookmark") {
      const { bookmarkId } = params;

      const { data: bookmark } = await sb
        .from("pending_restaurant_bookmarks")
        .select("*")
        .eq("id", bookmarkId)
        .eq("user_id", userId)
        .single();

      if (!bookmark) {
        return new Response(JSON.stringify({ error: "Bookmark not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!bookmark.restaurant_name || !bookmark.restaurant_address) {
        return new Response(JSON.stringify({ error: "Restaurant name and address are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: integration } = await sb
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId)
        .eq("integration_id", "googlemaps")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration?.composio_connection_id) {
        return new Response(JSON.stringify({ error: "Google Maps not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const success = await bookmarkOnGoogleMaps(
        integration.composio_connection_id,
        bookmark.restaurant_name,
        bookmark.restaurant_address,
        bookmark.restaurant_cuisine,
        bookmark.restaurant_notes
      );

      if (!success) {
        return new Response(JSON.stringify({ error: "Failed to bookmark restaurant" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark completed
      await sb
        .from("pending_restaurant_bookmarks")
        .update({ status: "completed" })
        .eq("id", bookmarkId);

      // Increment counter
      const { data: cfg } = await sb
        .from("restaurant_bookmark_config")
        .select("restaurants_bookmarked")
        .eq("user_id", userId)
        .single();

      await sb
        .from("restaurant_bookmark_config")
        .update({ restaurants_bookmarked: ((cfg as any)?.restaurants_bookmarked ?? 0) + 1 })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE-PENDING ──
    if (action === "update-pending") {
      const { bookmarkId, restaurantName, restaurantAddress, restaurantCuisine, restaurantNotes } = params;

      const updateFields: Record<string, any> = {};
      if (restaurantName !== undefined) updateFields.restaurant_name = restaurantName;
      if (restaurantAddress !== undefined) updateFields.restaurant_address = restaurantAddress;
      if (restaurantCuisine !== undefined) updateFields.restaurant_cuisine = restaurantCuisine;
      if (restaurantNotes !== undefined) updateFields.restaurant_notes = restaurantNotes;

      await sb
        .from("pending_restaurant_bookmarks")
        .update(updateFields)
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISMISS-PENDING ──
    if (action === "dismiss-pending") {
      const { bookmarkId } = params;

      await sb
        .from("pending_restaurant_bookmarks")
        .update({ status: "dismissed" })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANUAL-SYNC ──
    if (action === "manual-sync") {
      // Fetch user's LIAM API keys
      const { data: apiKeys } = await sb
        .from("user_api_keys")
        .select("api_key, private_key, user_key")
        .eq("user_id", userId)
        .maybeSingle();

      if (!apiKeys) {
        return new Response(JSON.stringify({ error: "LIAM API keys not configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Import private key and sign the request
      const pemContents = apiKeys.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "");
      const binaryString = atob(pemContents);
      const keyBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        keyBytes[i] = binaryString.charCodeAt(i);
      }
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBytes.buffer,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );

      const listBody = { userKey: apiKeys.user_key };
      const bodyStr = JSON.stringify(listBody);
      const rawSig = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        privateKey,
        new TextEncoder().encode(bodyStr)
      );

      // Convert to DER
      const sigBytes = new Uint8Array(rawSig);
      let r = Array.from(sigBytes.slice(0, 32));
      let s = Array.from(sigBytes.slice(32));
      if (r[0] & 0x80) r = [0, ...r];
      if (s[0] & 0x80) s = [0, ...s];
      while (r.length > 1 && r[0] === 0 && !(r[1] & 0x80)) r = r.slice(1);
      while (s.length > 1 && s[0] === 0 && !(s[1] & 0x80)) s = s.slice(1);
      let derInner = [0x02, r.length, ...r, 0x02, s.length, ...s];
      let der = [0x30, derInner.length, ...derInner];
      const signature = btoa(String.fromCharCode(...der));

      // Fetch memories from LIAM
      const listRes = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apiKey: apiKeys.api_key,
          signature,
        },
        body: bodyStr,
      });

      if (!listRes.ok) {
        console.error("[RestaurantSync] LIAM list error:", listRes.status);
        return new Response(JSON.stringify({ error: "Failed to fetch memories" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const listJson = await listRes.json();
      console.log("[RestaurantSync] LIAM list response keys:", JSON.stringify(Object.keys(listJson || {})));

      let rawMemories: any[] = [];
      if (Array.isArray(listJson)) {
        rawMemories = listJson;
      } else if (Array.isArray(listJson?.data)) {
        rawMemories = listJson.data;
      } else if (Array.isArray(listJson?.data?.memories)) {
        rawMemories = listJson.data.memories;
      } else if (listJson?.data && typeof listJson.data === "object") {
        for (const key of Object.keys(listJson.data)) {
          if (Array.isArray(listJson.data[key])) {
            rawMemories = listJson.data[key];
            console.log(`[RestaurantSync] Found memories in data.${key}`);
            break;
          }
        }
      }

      console.log(`[RestaurantSync] Found ${rawMemories.length} raw memories`);

      const memories: { id: string; content: string }[] = rawMemories
        .slice(0, 50)
        .map((m: any) => ({ id: m.transactionNumber || m.id || String(Math.random()), content: m.memory || m.content || '' }))
        .filter((m: any) => m.content);

      // Get already-processed memory IDs
      const { data: existing } = await sb
        .from("pending_restaurant_bookmarks")
        .select("memory_id")
        .eq("user_id", userId);
      const processedIds = new Set((existing || []).map((e: any) => e.memory_id));

      const unprocessed = memories.filter((m) => !processedIds.has(m.id));

      // Get Google Maps connection
      const { data: integration } = await sb
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId)
        .eq("integration_id", "googlemaps")
        .eq("status", "connected")
        .maybeSingle();

      let bookmarked = 0;
      let queued = 0;
      let processed = 0;

      console.log(`[RestaurantSync] Processing ${unprocessed.length} unprocessed memories`);

      const results = await Promise.all(
        unprocessed.map(async (mem) => {
          const r = { bookmarked: 0, queued: 0, processed: 0 };
          try {
            console.log(`[RestaurantSync] Parsing memory ${mem.id}: "${mem.content.substring(0, 80)}..."`);
            const parsed = await parseMemoryForRestaurant(mem.content);
            console.log(`[RestaurantSync] Parse result for ${mem.id}:`, JSON.stringify(parsed));
            r.processed++;

            if (!parsed.isRestaurant) return r;

            if (parsed.isComplete && parsed.name && parsed.address && integration?.composio_connection_id) {
              const ok = await bookmarkOnGoogleMaps(
                integration.composio_connection_id,
                parsed.name,
                parsed.address,
                parsed.cuisine,
                parsed.notes
              );
              if (ok) {
                await sb.from("pending_restaurant_bookmarks").upsert({
                  user_id: userId,
                  memory_id: mem.id,
                  memory_content: mem.content,
                  restaurant_name: parsed.name,
                  restaurant_address: parsed.address,
                  restaurant_cuisine: parsed.cuisine,
                  restaurant_notes: parsed.notes,
                  status: "completed",
                }, { onConflict: "user_id,memory_id" });
                r.bookmarked++;
                return r;
              }
            }

            // Queue incomplete or failed
            await sb.from("pending_restaurant_bookmarks").upsert({
              user_id: userId,
              memory_id: mem.id,
              memory_content: mem.content,
              restaurant_name: parsed.name,
              restaurant_address: parsed.address,
              restaurant_cuisine: parsed.cuisine,
              restaurant_notes: parsed.notes,
              status: "pending",
            }, { onConflict: "user_id,memory_id" });
            r.queued++;
          } catch (err) {
            console.error(`[RestaurantSync] Error processing memory ${mem.id}:`, err);
            r.processed++;
          }
          return r;
        })
      );

      for (const r of results) {
        bookmarked += r.bookmarked;
        queued += r.queued;
        processed += r.processed;
      }

      // Update counter
      if (bookmarked > 0) {
        const { data: cfg } = await sb
          .from("restaurant_bookmark_config")
          .select("restaurants_bookmarked")
          .eq("user_id", userId)
          .single();
        await sb
          .from("restaurant_bookmark_config")
          .update({ restaurants_bookmarked: ((cfg as any)?.restaurants_bookmarked ?? 0) + bookmarked })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed, bookmarked, queued }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[RestaurantSync] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
