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
const LIAM_API_KEY = Deno.env.get("LIAM_API_KEY")!;
const LIAM_USER_KEY = Deno.env.get("LIAM_USER_KEY")!;
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

// Fetch LIAM memories to pre-fill interests & location
async function fetchLiamMemories(): Promise<{ interests: string; location: string }> {
  let interests = "";
  let location = "";

  try {
    const res = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey: LIAM_API_KEY,
      },
      body: JSON.stringify({ userKey: LIAM_USER_KEY }),
    });

    if (res.ok) {
      const data = await res.json();
      const memories = data?.memories || data?.data || [];

      const interestWords: string[] = [];
      const locationWords: string[] = [];

      for (const m of memories) {
        const text = (m.memory || m.content || "").toLowerCase();
        if (/interest|hobby|hobbies|love|enjoy|passion|like doing/i.test(text)) {
          interestWords.push(m.memory || m.content);
        }
        if (/live in|based in|located|city|town|neighborhood|address/i.test(text)) {
          locationWords.push(m.memory || m.content);
        }
      }

      if (interestWords.length > 0) {
        interests = interestWords.slice(0, 5).join("; ");
      }
      if (locationWords.length > 0) {
        location = locationWords[0];
      }
    }
  } catch (e) {
    console.error("Failed to fetch LIAM memories:", e);
  }

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

// Filter out events with dates in the past
function isUpcomingEvent(event: any): boolean {
  const dateStr = event.date || event.start_date || event.when || "";
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

// Curate events via LLM
async function curateEvents(events: any[], interests: string): Promise<any[]> {
  if (events.length === 0) return [];

  const apiKey = LOVABLE_API_KEY;
  if (!apiKey) {
    console.warn("No LOVABLE_API_KEY — returning raw events");
    return events.slice(0, 5);
  }

  const eventSummaries = events
    .slice(0, 15)
    .map((e, i) => `${i + 1}. ${e.title || e.name || "Untitled"} — ${e.description || e.summary || ""} — ${e.date || e.start_date || ""} — ${e.link || e.url || e.event_url || ""}`)
    .join("\n");

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
            content: `You are an event curator. Given a user's interests and a list of events, pick the top 5 most relevant events.\n\nUser interests: ${interests}\n\nEvents:\n${eventSummaries}`,
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
                        date: { type: "string" },
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
        return parsed.events;
      }
    }

    // Fallback: try content field for backwards compat
    const content = data?.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return events.slice(0, 5);
  } catch (e) {
    console.error("LLM error:", e);
    return events.slice(0, 5);
  }
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
        const result = await fetchLiamMemories();
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
        console.log(`Found ${rawEvents.length} raw events`);

        // Curate via LLM
        const curated = await curateEvents(rawEvents, interests);
        console.log(`Curated to ${curated.length} events`);

        // Filter out already-processed events
        const { data: processed } = await sb
          .from("weekly_event_finder_processed")
          .select("event_id")
          .eq("user_id", userId);

        const processedIds = new Set((processed || []).map((p: any) => p.event_id));
        const newEvents = curated.filter((e: any) => {
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
          .map((e: any, i: number) => `${i + 1}. ${e.title || e.name}\n   ${e.date || ""}\n   ${e.description || ""}\n   ${e.reason || ""}${e.link ? `\n   ${e.link}` : ""}`)
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