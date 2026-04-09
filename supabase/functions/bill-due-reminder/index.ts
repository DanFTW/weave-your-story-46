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

function extractSender(email: any): string | null {
  const raw = email.from ?? email.From ?? email.sender ?? email.Sender ?? null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const nested = email.payload?.headers;
  if (Array.isArray(nested)) {
    const fromHeader = nested.find((h: any) => h.name?.toLowerCase() === "from");
    if (fromHeader?.value) return fromHeader.value;
  }
  return null;
}

function extractSubject(email: any): string | null {
  const raw = email.subject ?? email.Subject ?? null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof email.snippet?.subject === "string" && email.snippet.subject.trim()) {
    return email.snippet.subject.trim();
  }
  const nested = email.payload?.headers;
  if (Array.isArray(nested)) {
    const subjectHeader = nested.find((h: any) => h.name?.toLowerCase() === "subject");
    if (subjectHeader?.value) return subjectHeader.value;
  }
  return null;
}

function extractMessageId(email: any): string | null {
  const id = email.id ?? email.messageId ?? email.message_id ?? null;
  return typeof id === "string" && id ? id : null;
}

function extractBody(email: any): string {
  const snippet = email.snippet;
  if (typeof snippet === "object" && snippet !== null && snippet.body) {
    return snippet.body;
  }
  return email.messageText ?? email.body ?? (typeof snippet === "string" ? snippet : "") ?? "";
}

// ── Gmail connection ──

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

// ── Gmail fetch ──

const BILL_QUERY = "(bill OR payment OR invoice OR due OR statement OR utility OR autopay OR \"amount due\" OR \"payment due\" OR \"balance due\") newer_than:7d";

async function fetchEmails(connectionId: string): Promise<any[]> {
  console.log(`[BillReminder] Gmail query: ${BILL_QUERY}`);
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
          arguments: { query: BILL_QUERY, max_results: 50 },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[BillReminder] GMAIL_FETCH_EMAILS error ${res.status}:`, errText);
      return [];
    }

    const data = await res.json();
    const innerData = data?.data?.response_data ?? data?.response_data ?? data?.data ?? data;
    const messages = innerData?.messages ?? innerData?.emails ?? innerData?.data?.messages ??
                     innerData?.data?.emails ?? (Array.isArray(innerData) ? innerData : []);
    const result = Array.isArray(messages) ? messages : [];
    console.log(`[BillReminder] Messages found: ${result.length}`);
    return result;
  } catch (e) {
    console.error("[BillReminder] Fetch emails error:", e);
    return [];
  }
}

// ── AI extraction ──

interface BillDetails {
  billerName: string | null;
  amountDue: string | null;
  dueDate: string | null;
}

async function extractBillDetails(emailBody: string, subject: string | null): Promise<BillDetails> {
  if (!LOVABLE_API_KEY) {
    console.error("[BillReminder] LOVABLE_API_KEY not configured");
    return { billerName: null, amountDue: null, dueDate: null };
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
            content: `You extract bill/payment details from emails. Return ONLY valid JSON with these fields:
{"billerName": "string or null", "amountDue": "string or null", "dueDate": "string or null"}
billerName: The company or service provider name.
amountDue: The amount with currency symbol (e.g. "$45.99").
dueDate: The payment due date in a human-readable format (e.g. "Apr 15, 2026").
If a field cannot be determined, use null.`,
          },
          {
            role: "user",
            content: `Extract bill details from this email:\n\nSubject: ${subject || "N/A"}\n\nBody:\n${emailBody.slice(0, 3000)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[BillReminder] AI error:", res.status);
      return { billerName: null, amountDue: null, dueDate: null };
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return { billerName: null, amountDue: null, dueDate: null };

    const parsed = JSON.parse(content);
    return {
      billerName: parsed.billerName || null,
      amountDue: parsed.amountDue || null,
      dueDate: parsed.dueDate || null,
    };
  } catch (e) {
    console.error("[BillReminder] Extract error:", e);
    return { billerName: null, amountDue: null, dueDate: null };
  }
}

// ── LIAM Memory helpers ──

async function importPrivateKey(pemStr: string) {
  const pemContents = pemStr
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryString = atob(pemContents);
  const keyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function signRequest(privateKey: CryptoKey, bodyStr: string): Promise<string> {
  const rawSig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(bodyStr),
  );
  const sigBytes = new Uint8Array(rawSig);
  let r = Array.from(sigBytes.slice(0, 32));
  let s = Array.from(sigBytes.slice(32));
  if (r[0] & 0x80) r = [0, ...r];
  if (s[0] & 0x80) s = [0, ...s];
  while (r.length > 1 && r[0] === 0 && !(r[1] & 0x80)) r = r.slice(1);
  while (s.length > 1 && s[0] === 0 && !(s[1] & 0x80)) s = s.slice(1);
  const derInner = [0x02, r.length, ...r, 0x02, s.length, ...s];
  const der = [0x30, derInner.length, ...derInner];
  return btoa(String.fromCharCode(...der));
}

async function saveMemoryToLiam(
  apiKey: string,
  userKey: string,
  privateKeyPem: string,
  content: string,
  tag: string,
): Promise<boolean> {
  try {
    const key = await importPrivateKey(privateKeyPem);
    const body = { userKey, memory: content, tags: [tag] };
    const bodyStr = JSON.stringify(body);
    const signature = await signRequest(key, bodyStr);

    const res = await fetch("https://web.askbuddy.ai/devspacexdb/api/memory/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey,
        signature,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      console.error("[BillReminder] LIAM save error:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[BillReminder] LIAM save error:", e);
    return false;
  }
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
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
      await sb.from("bill_due_reminder_config").update({ is_active: true }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb.from("bill_due_reminder_config").update({ is_active: false }).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MANUAL-SYNC ──
    if (action === "manual-sync") {
      const { data: configData } = await sb
        .from("bill_due_reminder_config")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!configData) {
        return new Response(JSON.stringify({ error: "Config not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const connectionId = await getGmailConnectionId(sb, userId);
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Gmail not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emails = await fetchEmails(connectionId);

      // Deduplicate
      const { data: processedRows } = await sb
        .from("bill_due_reminder_processed")
        .select("email_message_id")
        .eq("user_id", userId);

      const processedIds = new Set((processedRows ?? []).map((r: any) => r.email_message_id));

      // Fetch LIAM keys for memory saving
      const { data: apiKeys } = await sb
        .from("user_api_keys")
        .select("api_key, user_key, private_key")
        .eq("user_id", userId)
        .maybeSingle();

      let billCount = 0;
      for (const email of emails) {
        const messageId = extractMessageId(email);
        if (!messageId || processedIds.has(messageId)) continue;

        const body = extractBody(email);
        if (!body) continue;

        const emailSubject = extractSubject(email);
        const details = await extractBillDetails(body, emailSubject);

        // Only save if we could extract at least a biller name or amount
        if (!details.billerName && !details.amountDue && !details.dueDate) continue;

        await sb.from("bill_due_reminder_processed").upsert({
          user_id: userId,
          email_message_id: messageId,
          biller_name: details.billerName,
          amount_due: details.amountDue,
          due_date: details.dueDate,
          subject: emailSubject,
        }, { onConflict: "user_id,email_message_id" });

        // Save to LIAM
        if (apiKeys) {
          const memoryContent = `Bill: ${details.billerName || "Unknown"} — ${details.amountDue || "amount unknown"}, due ${details.dueDate || "date unknown"}`;
          await saveMemoryToLiam(apiKeys.api_key, apiKeys.user_key, apiKeys.private_key, memoryContent, "BILL");
        }

        billCount++;
      }

      if (billCount > 0) {
        await sb.from("bill_due_reminder_config").update({
          bills_found: (configData.bills_found ?? 0) + billCount,
        }).eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed: emails.length, bills: billCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[BillReminder] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
