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

interface SenderRule {
  email: string;
  keywords: string[];
}

function buildGmailQuery(senderFilter: string | null, keywordFilter: string | null): string {
  if (!senderFilter) {
    return "newer_than:7d";
  }

  const trimmed = senderFilter.trim();

  // New JSON format: [{ email, keywords }]
  if (trimmed.startsWith("[")) {
    try {
      const rules: SenderRule[] = JSON.parse(trimmed);
      if (Array.isArray(rules) && rules.length > 0) {
        const ruleClauses = rules
          .filter((r) => r.email)
          .map((r) => {
            const from = `from:${r.email}`;
            if (r.keywords && r.keywords.length > 0) {
              const kws = r.keywords.map((k) => `"${k}"`).join(" OR ");
              return `(${from} (${kws}))`;
            }
            return `(${from})`;
          });

        if (ruleClauses.length > 0) {
          return `(${ruleClauses.join(" OR ")}) newer_than:7d`;
        }
      }
    } catch {
      // fall through to legacy
    }
  }

  // Legacy: comma/||| separated senders with optional global keywords
  const parts: string[] = [];
  const senders = trimmed.split(/\|\|\||,/).map((s) => s.trim()).filter(Boolean);
  if (senders.length > 0) {
    const fromClauses = senders.map((s) => `from:${s}`).join(" OR ");
    parts.push(`(${fromClauses})`);
  }

  if (keywordFilter) {
    const keywords = keywordFilter.split(/\|\|\||,/).map((k) => k.trim()).filter(Boolean);
    if (keywords.length > 0) {
      const kwClauses = keywords.map((k) => `"${k}"`).join(" OR ");
      parts.push(`(${kwClauses})`);
    }
  }

  const baseQuery = parts.length > 0 ? parts.join(" ") : "";
  return baseQuery ? `${baseQuery} newer_than:7d` : "newer_than:7d";
}

async function fetchEmails(connectionId: string, query: string): Promise<any[]> {
  console.log(`[TextAlert] Gmail query: ${query}`);
  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GMAIL_FETCH_EMAILS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: { query, max_results: 50 },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[TextAlert] GMAIL_FETCH_EMAILS error ${res.status}:`, errText);
      return [];
    }

    const data = await res.json();
    const innerData = data?.data?.response_data ?? data?.response_data ?? data?.data ?? data;
    const messages = innerData?.messages ?? innerData?.emails ?? innerData?.data?.messages ??
                     innerData?.data?.emails ?? (Array.isArray(innerData) ? innerData : []);
    const result = Array.isArray(messages) ? messages : [];
    console.log(`[TextAlert] Messages found: ${result.length}`);
    return result;
  } catch (e) {
    console.error("[TextAlert] Fetch emails error:", e);
    return [];
  }
}

async function summarizeEmail(emailBody: string): Promise<string> {
  if (!LOVABLE_API_KEY) {
    console.error("[TextAlert] LOVABLE_API_KEY not configured");
    return "Email summary unavailable";
  }

  try {
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
            content: "You create very brief SMS-style summaries of emails. Max 160 characters. Be direct and informative.",
          },
          {
            role: "user",
            content: `Summarize this email in under 160 characters for an SMS alert:\n\n"${emailBody.slice(0, 3000)}"`,
          },
        ],
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[TextAlert] AI error:", res.status);
      return "Email summary unavailable";
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    return content?.slice(0, 160) ?? "Email summary unavailable";
  } catch (e) {
    console.error("[TextAlert] Summarize error:", e);
    return "Email summary unavailable";
  }
}

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
      await sb.from("email_text_alert_config").update({ is_active: true }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb.from("email_text_alert_config").update({ is_active: false }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE-CONFIG ──
    if (action === "update-config") {
      const { senderFilter, keywordFilter, phoneNumber } = params;
      await sb.from("email_text_alert_config").update({
        sender_filter: senderFilter || null,
        keyword_filter: keywordFilter || null,
        phone_number: phoneNumber || null,
      }).eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANUAL-SYNC ──
    if (action === "manual-sync") {
      // 1. Get config
      const { data: configData } = await sb
        .from("email_text_alert_config")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!configData) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Get Gmail connection
      const connectionId = await getGmailConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Gmail not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Build query and fetch emails
      const query = buildGmailQuery(configData.sender_filter, configData.keyword_filter);
      const emails = await fetchEmails(connectionId, query);

      // 4. Get already-processed IDs
      const { data: processedRows } = await sb
        .from("email_text_alert_processed")
        .select("email_message_id")
        .eq("user_id", userId);

      const processedIds = new Set((processedRows ?? []).map((r: any) => r.email_message_id));

      // 5. Process new emails
      let alertCount = 0;
      for (const email of emails) {
        const messageId = email.id ?? email.messageId ?? email.message_id;
        if (!messageId || processedIds.has(messageId)) continue;

        const body = email.messageText ?? email.body ?? email.snippet ?? "";
        if (!body) continue;

        const summary = await summarizeEmail(body);

        // Insert into processed table
        await sb.from("email_text_alert_processed").insert({
          user_id: userId,
          email_message_id: messageId,
          summary,
        });

        // Send SMS alert
        await sendSms(configData.phone_number, summary);
        alertCount++;
      }

      // 6. Update alerts_sent counter
      if (alertCount > 0) {
        await sb.from("email_text_alert_config").update({
          alerts_sent: (configData.alerts_sent ?? 0) + alertCount,
        }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed: emails.length, alerts: alertCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[TextAlert] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
