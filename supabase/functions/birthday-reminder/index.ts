import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-trigger",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";

const BATCH_DELAY_MS = 500;

// ── LIAM Crypto ──

function removeLeadingZeros(arr: Uint8Array): Uint8Array {
  let i = 0;
  while (i < arr.length - 1 && arr[i] === 0) i++;
  return arr.slice(i);
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
  const innerLen = 1 + rLen.length + rPadded.length + 1 + sLen.length + sPadded.length;
  const outerLen = constructLength(innerLen);
  const der = new Uint8Array(1 + outerLen.length + innerLen);
  let offset = 0;
  der[offset++] = 0x30;
  der.set(outerLen, offset); offset += outerLen.length;
  der[offset++] = 0x02;
  der.set(rLen, offset); offset += rLen.length;
  der.set(rPadded, offset); offset += rPadded.length;
  der[offset++] = 0x02;
  der.set(sLen, offset); offset += sLen.length;
  der.set(sPadded, offset);
  return btoa(String.fromCharCode(...der));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const clean = pemKey.replace(/-----BEGIN.*-----/g, "").replace(/-----END.*-----/g, "").replace(/\s/g, "");
  const binary = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signBody(privateKey: CryptoKey, body: object): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(body));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, data);
  return toDER(new Uint8Array(sig));
}

// ── LIAM API helpers ──

async function liamListMemories(
  apiKeys: { api_key: string; private_key: string; user_key: string },
  query: string
): Promise<any[]> {
  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body: Record<string, string> = { userKey: apiKeys.user_key, query };
    const signature = await signBody(privateKey, body);

    const res = await fetch(`${LIAM_API_BASE}/memory/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apiKey: apiKeys.api_key, signature },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[Birthday] LIAM list error:", res.status, await res.text());
      return [];
    }

    const json = await res.json();
    // LIAM returns memories in data array or data.memories
    const memories = json?.data?.memories || json?.data || json?.memories || [];
    return Array.isArray(memories) ? memories : [];
  } catch (e) {
    console.error("[Birthday] LIAM list exception:", e);
    return [];
  }
}

// ── Birthday parsing ──

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

interface ParsedBirthday {
  personName: string;
  month: number;
  day: number;
  dateString: string; // e.g. "September 24"
}

function parseBirthdayFromMemory(memoryText: string): ParsedBirthday | null {
  // Pattern 1: "X's birthday is [on] Month Day"
  // Pattern 2: "Birthday of/for X is [on] Month Day"
  // Pattern 3: "X birthday [is] Month Day" (no possessive)
  // Pattern 4: "Month Day is X's birthday" (date-first)
  const patterns: { regex: RegExp; nameIdx: number; monthIdx: number; dayIdx: number }[] = [
    { regex: /(.+?)(?:'s|'s|\u2019s)\s+birthday\s+is\s+(?:on\s+)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i, nameIdx: 1, monthIdx: 2, dayIdx: 3 },
    { regex: /birthday\s+(?:of|for)\s+(.+?)\s+(?:is\s+)?(?:on\s+)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i, nameIdx: 1, monthIdx: 2, dayIdx: 3 },
    { regex: /(.+?)\s+birthday\s+(?:is\s+)?(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i, nameIdx: 1, monthIdx: 2, dayIdx: 3 },
    { regex: /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+is\s+(.+?)(?:'s|'s|\u2019s)?\s+birthday/i, nameIdx: 3, monthIdx: 1, dayIdx: 2 },
  ];

  for (const { regex, nameIdx, monthIdx, dayIdx } of patterns) {
    const match = memoryText.match(regex);
    if (match) {
      const name = match[nameIdx].trim();
      const monthStr = match[monthIdx].toLowerCase();
      const day = parseInt(match[dayIdx], 10);
      const month = MONTH_MAP[monthStr];
      if (month && day >= 1 && day <= 31) {
        return { personName: name, month, day, dateString: `${match[monthIdx]} ${match[dayIdx]}` };
      }
    }
  }
  return null;
}

function isBirthdayInDays(birthday: ParsedBirthday, daysAhead: number): boolean {
  const now = new Date();
  // Check if the birthday falls within the next 1 to daysAhead days (inclusive)
  for (let d = 1; d <= daysAhead; d++) {
    const target = new Date(now);
    target.setDate(target.getDate() + d);
    if (target.getMonth() + 1 === birthday.month && target.getDate() === birthday.day) {
      return true;
    }
  }
  return false;
}

// ── Email extraction ──

function extractEmailFromMemories(memories: any[], personName: string): string | null {
  const nameLower = personName.toLowerCase();
  const emailPattern = /[\w.+-]+@[\w.-]+\.\w+/;

  for (const mem of memories) {
    const text = (mem.memory || mem.content || mem.text || "").toLowerCase();
    if (text.includes(nameLower) && text.includes("email")) {
      const fullText = mem.memory || mem.content || mem.text || "";
      const emailMatch = fullText.match(emailPattern);
      if (emailMatch) return emailMatch[0];
    }
  }
  return null;
}

// ── AI email generation ──

async function generateBirthdayEmail(
  personName: string,
  birthdayDate: string,
  contextMemories: string[],
  senderName: string
): Promise<{ subject: string; body: string } | null> {
  if (!LOVABLE_API_KEY) {
    console.error("[Birthday] LOVABLE_API_KEY not configured");
    return null;
  }

  const contextBlock = contextMemories.length > 0
    ? `Here are some things I know about ${personName}:\n${contextMemories.map((m) => `- ${m}`).join("\n")}`
    : `I don't have much context about ${personName} beyond their birthday.`;

  const prompt = `Write a warm, personal birthday email for ${personName} whose birthday is ${birthdayDate}. The email should feel genuine and not generic.

${contextBlock}

The sender's name is ${senderName || "a friend"}.

Return ONLY a JSON object with "subject" and "body" keys. The body should be plain text (no HTML). Keep it concise — 3-5 sentences max.`;

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
          { role: "system", content: "You are a helpful assistant that writes personal birthday emails. Always respond with valid JSON." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "compose_birthday_email",
              description: "Compose a birthday email with subject and body",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  body: { type: "string", description: "Email body in plain text" },
                },
                required: ["subject", "body"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "compose_birthday_email" } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Birthday] AI Gateway error:", res.status, errText);
      return null;
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return { subject: parsed.subject, body: parsed.body };
    }

    // Fallback: try parsing content directly
    const content = json?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return { subject: parsed.subject, body: parsed.body };
    }

    return null;
  } catch (e) {
    console.error("[Birthday] AI generation error:", e);
    return null;
  }
}

// ── Send email via Composio ──

async function sendEmailViaComposio(
  connectionId: string,
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    console.log(`[Birthday] Sending email to ${to} via Composio`);

    const res = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {
          recipient_email: to,
          subject,
          message_body: body,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Birthday] Composio send error:", res.status, errText);
      return false;
    }

    console.log(`[Birthday] Email sent to ${to}`);
    return true;
  } catch (e) {
    console.error("[Birthday] Send email exception:", e);
    return false;
  }
}

// ── Delay utility ──
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Cron poll: process all active users ──

async function cronPoll(supabase: any): Promise<{ usersProcessed: number; remindersSent: number }> {
  const { data: activeConfigs, error } = await supabase
    .from("birthday_reminder_config")
    .select("*")
    .eq("is_active", true);

  if (error || !activeConfigs?.length) {
    console.log("[Birthday] No active configs or error:", error?.message);
    return { usersProcessed: 0, remindersSent: 0 };
  }

  console.log(`[Birthday] Processing ${activeConfigs.length} active users`);
  let totalSent = 0;

  for (const config of activeConfigs) {
    try {
      const sent = await processUser(supabase, config);
      totalSent += sent;
    } catch (e) {
      console.error(`[Birthday] Error processing user ${config.user_id}:`, e);
    }
  }

  return { usersProcessed: activeConfigs.length, remindersSent: totalSent };
}

async function processUser(supabase: any, config: any): Promise<number> {
  const userId = config.user_id;
  const daysBeforeTarget = config.days_before || 7;

  // Get LIAM API keys
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("api_key, private_key, user_key")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.log(`[Birthday] No API keys for user ${userId}`);
    return 0;
  }

  // Get Gmail connection
  const { data: gmailIntegration } = await supabase
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "gmail")
    .eq("status", "connected")
    .maybeSingle();

  if (!gmailIntegration?.composio_connection_id) {
    console.log(`[Birthday] No Gmail connection for user ${userId}`);
    return 0;
  }

  // Get user profile for sender name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();

  const senderName = profile?.full_name || "Your friend";

  // Query LIAM for birthday memories
  const birthdayMemories = await liamListMemories(apiKeys, "birthday");
  console.log(`[Birthday] Found ${birthdayMemories.length} birthday-related memories for user ${userId}`);

  const currentYear = new Date().getFullYear();
  let sentCount = 0;

  for (const mem of birthdayMemories) {
    const memText = mem.memory || mem.content || mem.text || "";
    const parsed = parseBirthdayFromMemory(memText);
    if (!parsed) continue;

    // Check if birthday is exactly daysBeforeTarget days away
    if (!isBirthdayInDays(parsed, daysBeforeTarget)) continue;

    console.log(`[Birthday] Upcoming birthday: ${parsed.personName} on ${parsed.dateString}`);

    // Check dedup
    const { data: existing } = await supabase
      .from("birthday_reminders_sent")
      .select("id")
      .eq("user_id", userId)
      .eq("person_name", parsed.personName)
      .eq("year_sent", currentYear)
      .maybeSingle();

    if (existing) {
      console.log(`[Birthday] Already sent reminder for ${parsed.personName} in ${currentYear}`);
      continue;
    }

    // Gather context memories about this person
    const personMemories = await liamListMemories(apiKeys, parsed.personName);
    const contextTexts = personMemories
      .map((m: any) => m.memory || m.content || m.text || "")
      .filter((t: string) => t && !t.toLowerCase().includes("birthday"))
      .slice(0, 10);

    // Extract email
    const recipientEmail = extractEmailFromMemories(personMemories, parsed.personName);
    if (!recipientEmail) {
      console.log(`[Birthday] No email found for ${parsed.personName}, skipping`);
      continue;
    }

    // Generate email via AI
    const email = await generateBirthdayEmail(parsed.personName, parsed.dateString, contextTexts, senderName);
    if (!email) {
      console.error(`[Birthday] AI failed to generate email for ${parsed.personName}`);
      continue;
    }

    // Send via Composio Gmail
    const sent = await sendEmailViaComposio(
      gmailIntegration.composio_connection_id,
      recipientEmail,
      email.subject,
      email.body
    );

    if (sent) {
      // Record dedup
      await supabase.from("birthday_reminders_sent").insert({
        user_id: userId,
        person_name: parsed.personName,
        birthday_date: parsed.dateString,
        year_sent: currentYear,
      });

      // Increment counter
      await supabase
        .from("birthday_reminder_config")
        .update({
          reminders_sent: (config.reminders_sent || 0) + 1,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      sentCount++;
      console.log(`[Birthday] ✅ Reminder sent for ${parsed.personName} → ${recipientEmail}`);
    }

    await delay(BATCH_DELAY_MS);
  }

  // Update last_checked_at even if no emails sent
  await supabase
    .from("birthday_reminder_config")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", config.id);

  return sentCount;
}

// ── Main handler ──

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    // ── Cron poll ──
    if (action === "cron-poll") {
      const cronSecret = req.headers.get("x-cron-secret");
      const cronTrigger = req.headers.get("x-cron-trigger");
      const validSecret = cronSecret && cronSecret === CRON_SECRET;
      const validTrigger = cronTrigger === "supabase-internal";

      if (!validSecret && !validTrigger) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await cronPoll(supabase);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Authenticated user actions ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    if (action === "activate") {
      await supabase.from("birthday_reminder_config").upsert(
        { user_id: userId, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      await supabase
        .from("birthday_reminder_config")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: config } = await supabase
        .from("birthday_reminder_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: sentReminders } = await supabase
        .from("birthday_reminders_sent")
        .select("*")
        .eq("user_id", userId)
        .order("sent_at", { ascending: false })
        .limit(20);

      return new Response(JSON.stringify({ config, sentReminders: sentReminders || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-config") {
      const { daysBefore } = body;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (daysBefore !== undefined) updates.days_before = daysBefore;

      await supabase.from("birthday_reminder_config").update(updates).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "manual-poll") {
      const { data: config } = await supabase
        .from("birthday_reminder_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!config) {
        return new Response(JSON.stringify({ error: "No config found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sent = await processUser(supabase, config);
      return new Response(JSON.stringify({ success: true, remindersSent: sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Birthday] Edge function error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
