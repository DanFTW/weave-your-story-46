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

// ── AI Event Parsing ──

interface ParsedEvent {
  isEvent: boolean;
  title: string | null;
  date: string | null;
  time: string | null;
  description: string | null;
  isComplete: boolean;
}

async function parseMemoryForEvent(content: string): Promise<ParsedEvent> {
  if (!LOVABLE_API_KEY) {
    console.error("[CalendarSync] LOVABLE_API_KEY not configured");
    return { isEvent: false, title: null, date: null, time: null, description: null, isComplete: false };
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "You extract event information from text. Only detect real events (meetings, appointments, deadlines, parties, etc). Do NOT flag generic statements or facts as events.",
          },
          {
            role: "user",
            content: `Extract event information from this text. If no event is detected, set isEvent to false.\n\nText: "${content}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_event",
              description: "Extract event details from text",
              parameters: {
                type: "object",
                properties: {
                  isEvent: { type: "boolean", description: "Whether the text describes a real event" },
                  title: { type: "string", description: "Event title, null if not an event" },
                  date: { type: "string", description: "Event date in YYYY-MM-DD format, null if unknown" },
                  time: { type: "string", description: "Event time in HH:mm format, null if unknown" },
                  description: { type: "string", description: "Brief event description" },
                  isComplete: { type: "boolean", description: "True if both title and date are present" },
                },
                required: ["isEvent", "title", "date", "time", "description", "isComplete"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_event" } },
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        console.warn("[CalendarSync] AI rate limited");
        return { isEvent: false, title: null, date: null, time: null, description: null, isComplete: false };
      }
      console.error("[CalendarSync] AI error:", res.status, await res.text());
      return { isEvent: false, title: null, date: null, time: null, description: null, isComplete: false };
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return { isEvent: false, title: null, date: null, time: null, description: null, isComplete: false };
  } catch (e) {
    console.error("[CalendarSync] Parse error:", e);
    return { isEvent: false, title: null, date: null, time: null, description: null, isComplete: false };
  }
}

// ── Create Google Calendar Event via Composio ──

async function createGCalEvent(
  connectionId: string,
  title: string,
  date: string,
  time: string | null,
  description: string | null
): Promise<boolean> {
  try {
    const startDate = time ? `${date}T${time}:00` : `${date}T09:00:00`;
    // Default 1-hour event
    const endHour = time ? parseInt(time.split(":")[0]) + 1 : 10;
    const endMinute = time ? time.split(":")[1] : "00";
    const endDate = `${date}T${String(endHour).padStart(2, "0")}:${endMinute}:00`;

    console.log(`[CalendarSync] Creating GCal event: "${title}" on ${startDate}`);

    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLECALENDAR_CREATE_EVENT",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            summary: title,
            start_datetime: startDate,
            end_datetime: endDate,
            description: description || "",
            timezone: "America/New_York",
          },
        }),
      }
    );

    const raw = await res.text();
    if (!res.ok) {
      console.error(`[CalendarSync] Composio error ${res.status}:`, raw);
      return false;
    }

    console.log("[CalendarSync] GCal event created successfully");
    return true;
  } catch (e) {
    console.error("[CalendarSync] GCal creation error:", e);
    return false;
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
        .from("calendar_event_sync_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb
        .from("calendar_event_sync_config")
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
        .from("calendar_event_sync_config")
        .select("is_active")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cfg?.is_active) {
        return new Response(JSON.stringify({ skipped: true, reason: "sync_inactive" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Parse
      const parsed = await parseMemoryForEvent(content);
      if (!parsed.isEvent) {
        return new Response(JSON.stringify({ skipped: true, reason: "not_event" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (parsed.isComplete && parsed.title && parsed.date) {
        // Get Google Calendar connection
        const { data: integration } = await sb
          .from("user_integrations")
          .select("composio_connection_id")
          .eq("user_id", userId)
          .eq("integration_id", "googlecalendar")
          .eq("status", "connected")
          .maybeSingle();

        if (integration?.composio_connection_id) {
          const success = await createGCalEvent(
            integration.composio_connection_id,
            parsed.title,
            parsed.date,
            parsed.time,
            parsed.description
          );

          if (success) {
            // Record as completed
            await sb.from("pending_calendar_events").upsert({
              user_id: userId,
              memory_id: memoryId,
              memory_content: content,
              event_title: parsed.title,
              event_date: parsed.date,
              event_time: parsed.time,
              event_description: parsed.description,
              status: "completed",
            }, { onConflict: "user_id,memory_id" });

            // Increment counter
            await sb.rpc("", {}).catch(() => {});
            await sb
              .from("calendar_event_sync_config")
              .update({ events_created: (cfg as any).events_created ? (cfg as any).events_created + 1 : 1 })
              .eq("user_id", userId);

            return new Response(JSON.stringify({ created: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Incomplete or failed — queue it
      await sb.from("pending_calendar_events").upsert({
        user_id: userId,
        memory_id: memoryId,
        memory_content: content,
        event_title: parsed.title,
        event_date: parsed.date,
        event_time: parsed.time,
        event_description: parsed.description,
        status: "pending",
      }, { onConflict: "user_id,memory_id" });

      return new Response(JSON.stringify({ queued: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CREATE-EVENT (from pending queue) ──
    if (action === "create-event") {
      const { eventId } = params;

      const { data: event } = await sb
        .from("pending_calendar_events")
        .select("*")
        .eq("id", eventId)
        .eq("user_id", userId)
        .single();

      if (!event) {
        return new Response(JSON.stringify({ error: "Event not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!event.event_title || !event.event_date) {
        return new Response(JSON.stringify({ error: "Event title and date are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: integration } = await sb
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId)
        .eq("integration_id", "googlecalendar")
        .eq("status", "connected")
        .maybeSingle();

      if (!integration?.composio_connection_id) {
        return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const success = await createGCalEvent(
        integration.composio_connection_id,
        event.event_title,
        event.event_date,
        event.event_time,
        event.event_description
      );

      if (!success) {
        return new Response(JSON.stringify({ error: "Failed to create calendar event" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark completed
      await sb
        .from("pending_calendar_events")
        .update({ status: "completed" })
        .eq("id", eventId);

      // Increment counter
      const { data: cfg } = await sb
        .from("calendar_event_sync_config")
        .select("events_created")
        .eq("user_id", userId)
        .single();

      await sb
        .from("calendar_event_sync_config")
        .update({ events_created: ((cfg as any)?.events_created ?? 0) + 1 })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE-PENDING ──
    if (action === "update-pending") {
      const { eventId, eventTitle, eventDate, eventTime, eventDescription } = params;

      const updateFields: Record<string, any> = {};
      if (eventTitle !== undefined) updateFields.event_title = eventTitle;
      if (eventDate !== undefined) updateFields.event_date = eventDate;
      if (eventTime !== undefined) updateFields.event_time = eventTime;
      if (eventDescription !== undefined) updateFields.event_description = eventDescription;

      await sb
        .from("pending_calendar_events")
        .update(updateFields)
        .eq("id", eventId)
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISMISS-PENDING ──
    if (action === "dismiss-pending") {
      const { eventId } = params;

      await sb
        .from("pending_calendar_events")
        .update({ status: "dismissed" })
        .eq("id", eventId)
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
        console.error("[CalendarSync] LIAM list error:", listRes.status);
        return new Response(JSON.stringify({ error: "Failed to fetch memories" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const listJson = await listRes.json();
      const memories: { id: string; content: string }[] = (listJson?.data || [])
        .slice(0, 50)
        .map((m: any) => ({ id: m.transactionNumber || m.id || String(Math.random()), content: m.content }))
        .filter((m: any) => m.content);

      // Get already-processed memory IDs
      const { data: existing } = await sb
        .from("pending_calendar_events")
        .select("memory_id")
        .eq("user_id", userId);
      const processedIds = new Set((existing || []).map((e: any) => e.memory_id));

      const unprocessed = memories.filter((m) => !processedIds.has(m.id));

      // Get GCal connection
      const { data: integration } = await sb
        .from("user_integrations")
        .select("composio_connection_id")
        .eq("user_id", userId)
        .eq("integration_id", "googlecalendar")
        .eq("status", "connected")
        .maybeSingle();

      let created = 0;
      let queued = 0;
      let processed = 0;

      for (const mem of unprocessed) {
        const parsed = await parseMemoryForEvent(mem.content);
        processed++;

        if (!parsed.isEvent) continue;

        if (parsed.isComplete && parsed.title && parsed.date && integration?.composio_connection_id) {
          const ok = await createGCalEvent(
            integration.composio_connection_id,
            parsed.title,
            parsed.date,
            parsed.time,
            parsed.description
          );
          if (ok) {
            await sb.from("pending_calendar_events").upsert({
              user_id: userId,
              memory_id: mem.id,
              memory_content: mem.content,
              event_title: parsed.title,
              event_date: parsed.date,
              event_time: parsed.time,
              event_description: parsed.description,
              status: "completed",
            }, { onConflict: "user_id,memory_id" });
            created++;
            continue;
          }
        }

        // Queue incomplete or failed
        await sb.from("pending_calendar_events").upsert({
          user_id: userId,
          memory_id: mem.id,
          memory_content: mem.content,
          event_title: parsed.title,
          event_date: parsed.date,
          event_time: parsed.time,
          event_description: parsed.description,
          status: "pending",
        }, { onConflict: "user_id,memory_id" });
        queued++;
      }

      // Update events_created counter
      if (created > 0) {
        const { data: cfg } = await sb
          .from("calendar_event_sync_config")
          .select("events_created")
          .eq("user_id", userId)
          .single();
        await sb
          .from("calendar_event_sync_config")
          .update({ events_created: ((cfg as any)?.events_created ?? 0) + created })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed, created, queued }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[CalendarSync] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
