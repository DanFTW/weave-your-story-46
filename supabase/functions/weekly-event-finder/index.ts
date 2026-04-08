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
// LIAM_API_KEY and LIAM_USER_KEY removed — prefill now routes through the
// per-user liam-memory proxy which handles its own auth.
const SMS_API_KEY = Deno.env.get("SMS_API_KEY")!;

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

async function getGmailConnectionId(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "gmail")
    .eq("status", "connected")
    .maybeSingle();
  return data?.composio_connection_id ?? null;
}

// ── Memory extraction helpers ──────────────────────────────────────────

/** Tags that strongly indicate an interest/hobby memory */
const INTEREST_TAGS = new Set([
  "INTEREST", "HOBBY", "INTEREST/HOBBY", "INTERESTS", "HOBBIES",
  "LIFESTYLE", "PERSONAL", "ENTERTAINMENT", "SPORTS", "MUSIC",
  "FOOD", "COOKING", "TRAVEL", "FITNESS", "GAMING", "ART",
]);

/** Tags that strongly indicate a location memory */
const LOCATION_TAGS = new Set([
  "LOCATION", "ADDRESS", "HOME", "CITY", "TRAVEL",
]);

/** Regex patterns that signal interest-bearing text */
const INTEREST_PATTERNS = [
  /my interests and hobbies include[:\s]*/i,
  /\b(?:i love|i enjoy|i like|i'm into|i am into|passionate about|obsessed with|hobbies include|interested in|fan of)\b/i,
  /\b(?:interest|hobby|hobbies|passion|favorite)\b/i,
];

/** Regex patterns that signal location-bearing text */
const LOCATION_PATTERNS = [
  /\b(?:live[sd]? in|based in|located in|from|residing in|moved to|my city is|my town is)\b/i,
  /\b(?:neighborhood|zip code|address)\b/i,
];

/**
 * Parse the "My interests and hobbies include: X, Y, Z" format
 * into individual tag strings.
 */
function parseInterestStatement(text: string): string[] {
  const prefixMatch = text.match(/my interests and hobbies include[:\s]*(.*)/i);
  if (prefixMatch) {
    return prefixMatch[1]
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 80);
  }
  return [];
}

/**
 * Normalize a tag string: trim, collapse whitespace, title-case.
 */
function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Deduplicate tags case-insensitively, preserving first occurrence order.
 */
function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}

/**
 * Extract a clean location string from memory text.
 */
function extractLocationFromText(text: string): string | null {
  // "I live in Miami" → "Miami"
  const match = text.match(
    /(?:live[sd]? in|based in|located in|from|moved to|residing in)\s+([A-Z][A-Za-z\s,]+)/i
  );
  if (match) return match[1].replace(/[.,;!]+$/, "").trim();
  return null;
}

// ── Fetch memories via internal liam-memory proxy ──────────────────────

async function fetchLiamMemories(userId: string): Promise<{ interests: string; location: string }> {
  const interestTags: string[] = [];
  let locationCandidate = "";

  try {
    // Call the existing liam-memory edge function internally using
    // the service role key + x-supabase-user-id header (trusted path).
    const liamUrl = `${SUPABASE_URL}/functions/v1/liam-memory`;
    console.log("[Prefill] Calling liam-memory proxy for user:", userId);

    const res = await fetch(liamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-supabase-user-id": userId,
      },
      body: JSON.stringify({ action: "list" }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "(unreadable)");
      console.error(`[Prefill] liam-memory returned ${res.status}:`, errBody.slice(0, 500));
      return { interests: "", location: "" };
    }

    const data = await res.json();
    // The liam-memory proxy returns the LIAM API response directly.
    // Shape: { data: { memories: [...] } } or { memories: [...] } or array
    const memories: any[] =
      data?.data?.memories || data?.memories || (Array.isArray(data) ? data : []);

    console.log(`[Prefill] Retrieved ${memories.length} memories from LIAM`);

    for (const m of memories) {
      const text: string = m.memory || m.content || "";
      const tag: string = (m.tag || m.notesKey || "").toUpperCase().replace(/\s+/g, "_");

      // ── Interest extraction (tag-first, then text patterns) ──

      // 1. Check tag
      const isInterestTag = INTEREST_TAGS.has(tag) || tag.includes("INTEREST") || tag.includes("HOBBY");

      // 2. Parse structured "My interests and hobbies include: ..." statement
      const parsedFromStatement = parseInterestStatement(text);
      if (parsedFromStatement.length > 0) {
        interestTags.push(...parsedFromStatement.map(normalizeTag));
        continue; // already extracted granularly
      }

      // 3. Tag-based match — use the full text as an interest description
      if (isInterestTag && text.length > 2 && text.length < 200) {
        interestTags.push(normalizeTag(text));
        continue;
      }

      // 4. Text-pattern match on broader memories
      const matchesInterestPattern = INTEREST_PATTERNS.some((p) => p.test(text));
      if (matchesInterestPattern && text.length > 2 && text.length < 200) {
        interestTags.push(normalizeTag(text));
      }

      // ── Location extraction (tag-first, then text patterns) ──

      const isLocationTag = LOCATION_TAGS.has(tag) || tag.includes("LOCATION");

      if (isLocationTag && text.length > 2 && !locationCandidate) {
        // Try to extract a clean city/place, fall back to full text
        locationCandidate = extractLocationFromText(text) || text.trim();
        continue;
      }

      if (!locationCandidate) {
        const matchesLocationPattern = LOCATION_PATTERNS.some((p) => p.test(text));
        if (matchesLocationPattern) {
          const extracted = extractLocationFromText(text);
          if (extracted) locationCandidate = extracted;
        }
      }
    }
  } catch (e) {
    console.error("[Prefill] Failed to fetch LIAM memories:", e);
  }

  const dedupedInterests = deduplicateTags(interestTags);
  const interests = dedupedInterests.slice(0, 15).join(", ");
  const location = locationCandidate;

  console.log(`[Prefill] Extracted ${dedupedInterests.length} interest tags, location: "${location}"`);
  return { interests, location };
}

// Search events for a single interest via Composio (no auth required)
async function searchEventsSingle(interest: string, location: string): Promise<any[]> {
  const searchQuery = `${interest.trim()} events in ${location.trim()}`;
  const url = "https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT_SEARCH";
  const body = {
    appName: "composio_search",
    entity_id: "default",
    arguments: { query: searchQuery, location: location.trim() },
  };

  console.log("[EventSearch] Query:", searchQuery);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const rawText = await res.text();
    console.log("[EventSearch] Status:", res.status);
    console.log("[EventSearch] Response (first 2000 chars):", rawText.slice(0, 2000));

    if (!res.ok) {
      console.error("[EventSearch] Non-OK status:", res.status);
      return [];
    }

    const data = JSON.parse(rawText);

    if (data?.successful === false || data?.error) {
      console.error("[EventSearch] Composio error:", JSON.stringify(data.error || data));
      return [];
    }

    const candidates = [
      data?.data?.results?.events_results,
      data?.data?.response_data?.events_results,
      data?.data?.response_data?.results,
      data?.data?.response_data?.data?.items,
      data?.data?.response_data?.items,
      data?.data?.response_data,
      data?.data?.items,
      data?.response_data?.events_results,
      data?.response_data?.results,
      data?.response_data,
      data?.items,
      data?.events_results,
      data?.results,
    ];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (Array.isArray(c) && c.length > 0) {
        console.log(`[EventSearch] Found ${c.length} events at extraction path index ${i}`);
        return c;
      }
    }

    console.warn("[EventSearch] No events found for query:", searchQuery);
    return [];
  } catch (e) {
    console.error("[EventSearch] Error:", e);
    return [];
  }
}

// Split interests and search each individually, then deduplicate
async function searchEvents(interests: string, location: string): Promise<any[]> {
  const terms = interests.split(",").map(s => s.trim()).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return [];

  const allResults: any[] = [];
  const seenTitles = new Set<string>();

  for (const term of terms) {
    const results = await searchEventsSingle(term, location);
    for (const r of results) {
      const key = (r.title || r.name || "").toLowerCase();
      if (key && !seenTitles.has(key)) {
        seenTitles.add(key);
        allResults.push(r);
      }
    }
  }

  console.log(`[EventSearch] Total unique events across ${terms.length} searches: ${allResults.length}`);
  return allResults;
}

// Safely coerce any date field value (string, object, Date) into a string
function extractDateString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, any>;
    // Prioritize human-readable 'when' field from Composio
    if (v.when && typeof v.when === "string") return v.when;
    if (v.dateTime && typeof v.dateTime === "string") return String(v.dateTime);
    if (v.start_date && typeof v.start_date === "string") return v.start_date;
    if (v.date && typeof v.date === "string") return String(v.date);
    if (v.year && v.month && v.day) {
      const pad = (n: number) => String(n).padStart(2, "0");
      let s = `${v.year}-${pad(v.month)}-${pad(v.day)}`;
      if (v.hour != null) s += `T${pad(v.hour)}:${pad(v.minute || 0)}:00`;
      return s;
    }
    // Recurse into nested objects for known date keys
    if (v.when) return extractDateString(v.when);
    if (v.dateTime) return extractDateString(v.dateTime);
    if (v.date) return extractDateString(v.date);
    if (v.start_date) return extractDateString(v.start_date);
    try { return JSON.stringify(value); } catch { return ""; }
  }
  return String(value);
}

// Filter out events with dates in the past
function isUpcomingEvent(event: any): boolean {
  const dateStr = extractDateString(event.when) || extractDateString(event.date) || extractDateString(event.start_date);
  if (!dateStr) return true;
  try {
    const eventDate = new Date(dateStr);
    if (isNaN(eventDate.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  } catch {
    return true;
  }
}

// Curate events via LLM, then recover any dates the LLM dropped
async function curateEvents(events: any[], interests: string): Promise<any[]> {
  if (events.length === 0) return [];

  const apiKey = LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("No LOVABLE_API_KEY — returning raw events");
    return events.slice(0, 5);
  }

  const eventSummaries = events
    .slice(0, 15)
    .map((e, i) => `${i + 1}. ${e.title || e.name || "Untitled"} — ${e.description || e.summary || ""} — Date: ${extractDateString(e.when) || extractDateString(e.date) || extractDateString(e.start_date) || "unknown"} — ${e.link || e.url || e.event_url || ""}`)
    .join("\n");

  let curated: any[];

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: `You are an event curator. Given a user's interests and a list of events, pick the top 5 most relevant events.\n\nIMPORTANT: For each event, copy the EXACT date string from the input into the "date" field. Do not rephrase, summarize, or omit dates. If the input says "Date: Sat, Apr 12, 7 PM", return exactly that.\n\nUser interests: ${interests}\n\nEvents:\n${eventSummaries}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "select_events",
              description: "Return the top 5 most relevant events for the user.",
              parameters: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        date: { type: "string", description: "The exact date string copied verbatim from the input" },
                        description: { type: "string" },
                        reason: { type: "string" },
                        link: { type: "string" },
                      },
                      required: ["title", "date", "description", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["events"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "select_events" } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429) {
        console.error("LLM curation rate limited (429):", errText);
      } else if (res.status === 402) {
        console.error("LLM curation payment required (402):", errText);
      } else {
        console.error("LLM curation failed:", res.status, errText);
      }
      return events.slice(0, 5);
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      if (Array.isArray(parsed.events) && parsed.events.length > 0) {
        curated = parsed.events;
      } else {
        curated = events.slice(0, 5);
      }
    } else {
      // Fallback: try content field for backwards compat
      const content = data?.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        curated = JSON.parse(jsonMatch[0]);
      } else {
        curated = events.slice(0, 5);
      }
    }
  } catch (e) {
    console.error("LLM error:", e);
    return events.slice(0, 5);
  }

  // Post-curation date recovery: if the LLM dropped or mangled a date,
  // recover it from the original raw event data by matching on title.
  const titleToRawDate = new Map<string, string>();
  for (const e of events) {
    const key = (e.title || e.name || "").toLowerCase().trim();
    const rawDate = extractDateString(e.when) || extractDateString(e.date) || extractDateString(e.start_date);
    if (key && rawDate) {
      titleToRawDate.set(key, rawDate);
    }
  }

  for (const c of curated) {
    if (!c.date || c.date === "unknown" || c.date.trim() === "") {
      const key = (c.title || c.name || "").toLowerCase().trim();
      const recovered = titleToRawDate.get(key);
      if (recovered) {
        console.log(`[EventCurate] Recovered date for "${c.title}": ${recovered}`);
        c.date = recovered;
      }
    }
  }

  return curated;
}

// Send email via Composio Gmail — with full response inspection
async function sendEmail(connId: string, to: string, subject: string, bodyText: string): Promise<boolean> {
  try {
    const res = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connId,
        auth_config_id: "ac_IlbziSKZknmH",
        arguments: {
          recipient_email: to,
          subject,
          body: bodyText,
        },
      }),
    });

    const data = await res.json();
    console.log("[EventFinder] Gmail send response:", res.status, JSON.stringify(data).slice(0, 1000));

    if (!res.ok) {
      console.error("[EventFinder] Gmail send HTTP error:", res.status, JSON.stringify(data));
      return false;
    }

    if (data?.successful === false || data?.error) {
      console.error("[EventFinder] Gmail send logical failure:", JSON.stringify(data));
      return false;
    }

    console.log("[EventFinder] Gmail send succeeded to:", to);
    return true;
  } catch (e) {
    console.error("[EventFinder] Gmail send exception:", e);
    return false;
  }
}

// Send SMS via weave-mcp-server gateway
async function sendSms(to: string, body: string): Promise<boolean> {
  try {
    const res = await fetch("https://weave-fabric-sms.onrender.com/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": SMS_API_KEY,
      },
      body: JSON.stringify({ to, body }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[EventFinder] SMS send failed:", res.status, errText);
      return false;
    }

    console.log("[EventFinder] SMS sent to:", to);
    return true;
  } catch (e) {
    console.error("[EventFinder] SMS send exception:", e);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    const sb = adminClient();

    switch (action) {
      case "activate": {
        await sb
          .from("weekly_event_finder_config")
          .update({ is_active: true })
          .eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "deactivate": {
        await sb
          .from("weekly_event_finder_config")
          .update({ is_active: false })
          .eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-config": {
        const { interests, location, frequency, deliveryMethod, email, phoneNumber } = params;
        await sb
          .from("weekly_event_finder_config")
          .update({
            interests,
            location,
            frequency,
            delivery_method: deliveryMethod,
            email,
            phone_number: phoneNumber ?? null,
          })
          .eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "prefill": {
        const result = await fetchLiamMemories(userId);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "manual-sync": {
        // Load config
        const { data: cfg } = await sb
          .from("weekly_event_finder_config")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!cfg) {
          return new Response(JSON.stringify({ error: "No config found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const interests = cfg.interests || "";
        const location = cfg.location || "";

        if (!interests || !location) {
          return new Response(JSON.stringify({ error: "Interests and location required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Search events
        const rawEvents = await searchEvents(interests, location);
        const upcomingRaw = rawEvents.filter(isUpcomingEvent);
        console.log(`Found ${rawEvents.length} raw events, ${upcomingRaw.length} upcoming`);

        // Curate via LLM
        const curated = await curateEvents(upcomingRaw, interests);
        const upcomingCurated = curated.filter(isUpcomingEvent);
        console.log(`Curated to ${curated.length} events, ${upcomingCurated.length} upcoming`);

        // Filter out already-processed events
        const { data: processed } = await sb
          .from("weekly_event_finder_processed")
          .select("event_id")
          .eq("user_id", userId);

        const processedIds = new Set((processed || []).map((p: any) => p.event_id));
        const newEvents = upcomingCurated.filter((e: any) => {
          const eventId = e.title || e.name || JSON.stringify(e);
          return !processedIds.has(eventId);
        });

        if (newEvents.length === 0) {
          return new Response(JSON.stringify({ eventsFound: 0, delivered: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Build delivery content
        const eventList = newEvents
          .map((e: any, i: number) => {
            const title = e.title || e.name || "Untitled Event";
            const dateStr = extractDateString(e.when) || extractDateString(e.date) || extractDateString(e.start_date);
            let formattedDate = dateStr;
            // Only reformat if it looks like an ISO date; human-readable strings (e.g. "Sat, May 16, 4 – 8 PM EDT") pass through as-is
            if (dateStr && /^\d{4}-\d{2}/.test(dateStr)) {
              try {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                  formattedDate = d.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  });
                  if (d.getHours() !== 0 || d.getMinutes() !== 0) {
                    const timeStr = d.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                      timeZoneName: "short",
                    });
                    formattedDate += ` @ ${timeStr}`;
                  }
                }
              } catch {
                // keep raw dateStr
              }
            }
            const dateLine = formattedDate ? `\n   📅 ${formattedDate}` : "";
            const desc = e.description ? `\n   ${e.description}` : "";
            const reason = e.reason ? `\n   Why: ${e.reason}` : "";
            const link = e.link ? `\n   🔗 ${e.link}` : "";
            return `${i + 1}. ${title}${dateLine}${desc}${reason}${link}`;
          })
          .join("\n\n");

        const emailBody = `Hi! Here are events we found matching your interests:\n\n${eventList}\n\n— Weave Event Finder`;

        let delivered = 0;

        if (cfg.delivery_method === "email" && cfg.email) {
          const connId = await getGmailConnectionId(sb, userId);
          if (connId) {
            const sent = await sendEmail(
              connId,
              cfg.email,
              `🎉 ${newEvents.length} Events Found For You`,
              emailBody
            );
            if (sent) delivered = newEvents.length;
          } else {
            console.warn("[EventFinder] No Gmail connection found for email delivery");
          }
        } else if (cfg.delivery_method === "text" && cfg.phone_number) {
          const sent = await sendSms(cfg.phone_number, emailBody);
          if (sent) delivered = newEvents.length;
        } else {
          console.warn("[EventFinder] No valid delivery target configured — method:", cfg.delivery_method, "email:", cfg.email, "phone:", cfg.phone_number);
        }

        // Record processed events
        for (const e of newEvents) {
          const eventId = e.title || e.name || JSON.stringify(e);
          await sb.from("weekly_event_finder_processed").upsert(
            { user_id: userId, event_id: eventId, event_title: e.title || e.name || "" },
            { onConflict: "user_id,event_id" }
          );
        }

        // Update counter
        await sb
          .from("weekly_event_finder_config")
          .update({ events_found: (cfg.events_found || 0) + newEvents.length })
          .eq("user_id", userId);

        return new Response(JSON.stringify({ eventsFound: newEvents.length, delivered }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("Edge function error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});