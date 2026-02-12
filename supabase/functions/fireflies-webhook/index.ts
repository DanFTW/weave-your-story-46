import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY")!;
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

// === VERIFY FIREFLIES SIGNATURE ===

async function verifyFirefliesSignature(rawBody: string, secret: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) {
    console.log("[Fireflies Webhook] No signature header, skipping verification");
    // Fireflies may not always send signatures; allow through if token is valid
    return true;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computed = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
    return computed === signatureHeader;
  } catch (err) {
    console.error("[Fireflies Webhook] Signature verification error:", err);
    return false;
  }
}

// === GET CONFIG BY TOKEN ===

async function getAutomationConfigByToken(supabase: any, token: string) {
  const { data, error } = await supabase
    .from("fireflies_automation_config")
    .select("*")
    .eq("webhook_token", token)
    .maybeSingle();

  if (error) console.error("[Fireflies Webhook] Config lookup error:", error);
  return data;
}

// === FETCH TRANSCRIPT VIA COMPOSIO ===

async function fetchTranscriptViaComposio(userId: string, meetingId: string, supabase: any) {
  // Get user's Fireflies connection
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", "fireflies")
    .eq("status", "connected")
    .maybeSingle();

  if (!integration?.composio_connection_id) {
    console.error("[Fireflies Webhook] No Fireflies connection for user", userId);
    return null;
  }

  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/FIREFLIES_GET_TRANSCRIPT_BY_ID",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: integration.composio_connection_id,
          arguments: { id: meetingId },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Fireflies Webhook] Composio error:", response.status, errorText.slice(0, 500));
      return null;
    }

    const result = await response.json();
    return result?.data?.response_data ?? result?.data ?? result?.response_data ?? result;
  } catch (err) {
    console.error("[Fireflies Webhook] Composio fetch error:", err);
    return null;
  }
}

// === FORMAT TRANSCRIPT AS MEMORY ===

function formatTranscriptAsMemory(transcript: any, meetingId: string): string {
  const parts = ["Fireflies Meeting Transcript", ""];

  const title = transcript?.title || transcript?.meeting_title || `Meeting ${meetingId}`;
  parts.push(`Title: ${title}`);

  if (transcript?.date || transcript?.dateString) {
    parts.push(`Date: ${transcript.date || transcript.dateString}`);
  }

  if (transcript?.duration) {
    const mins = Math.round(transcript.duration / 60);
    parts.push(`Duration: ${mins} minutes`);
  }

  if (transcript?.participants && Array.isArray(transcript.participants)) {
    parts.push(`Participants: ${transcript.participants.join(", ")}`);
  } else if (transcript?.organizer_email) {
    parts.push(`Organizer: ${transcript.organizer_email}`);
  }

  if (transcript?.summary?.overview) {
    parts.push("");
    parts.push(`Summary: ${transcript.summary.overview}`);
  }

  parts.push("");
  parts.push("A meeting transcript was automatically saved from Fireflies.ai.");

  return parts.join("\n");
}

// === SAVE MEMORY TO LIAM ===

async function saveMemoryToLiam(supabase: any, userId: string, content: string): Promise<boolean> {
  const { data: apiKeys } = await supabase
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!apiKeys) {
    console.error("[Fireflies Webhook] No API keys for user", userId);
    return false;
  }

  try {
    const privateKey = await importPrivateKey(apiKeys.private_key);
    const body = { userKey: apiKeys.user_key, content };
    const signature = await signRequest(privateKey, body);
    const response = await fetch(`${LIAM_API_BASE}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apiKey": apiKeys.api_key, "signature": signature },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Fireflies Webhook] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[Fireflies Webhook] Error creating memory:", error);
    return false;
  }
}

// === MARK TRANSCRIPT PROCESSED ===

async function markTranscriptProcessed(supabase: any, userId: string, transcriptId: string): Promise<boolean> {
  const { error } = await supabase
    .from("fireflies_processed_transcripts")
    .insert({ user_id: userId, fireflies_transcript_id: transcriptId });

  if (error) {
    if (error.code === "23505") {
      // Duplicate - already processed
      return false;
    }
    console.error("[Fireflies Webhook] Insert processed error:", error);
    return false;
  }
  return true;
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    if (!token || token === "fireflies-webhook") {
      return new Response(JSON.stringify({ error: "Missing webhook token" }), { status: 404 });
    }

    console.log(`[Fireflies Webhook] Received event for token: ${token.slice(0, 8)}...`);

    // Look up config by webhook_token
    const config = await getAutomationConfigByToken(supabase, token);

    if (!config) {
      console.error("[Fireflies Webhook] No config found for token");
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    if (!config.is_active) {
      console.log("[Fireflies Webhook] Config inactive, ignoring");
      return new Response(null, { status: 204 });
    }

    // Read raw body for signature verification
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-ff-signature") || req.headers.get("x-fireflies-signature");

    // Verify signature
    const isValid = await verifyFirefliesSignature(rawBody, config.webhook_secret, signatureHeader);
    if (!isValid) {
      console.error("[Fireflies Webhook] Invalid signature");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[Fireflies Webhook] Invalid JSON body");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const meetingId = payload?.meetingId || payload?.meeting_id || payload?.data?.meetingId || payload?.data?.id;
    if (!meetingId) {
      console.error("[Fireflies Webhook] No meetingId in payload:", JSON.stringify(payload).slice(0, 200));
      return new Response(JSON.stringify({ error: "Missing meetingId" }), { status: 400 });
    }

    console.log(`[Fireflies Webhook] Processing meeting: ${meetingId}`);

    // Dedup check
    const isNew = await markTranscriptProcessed(supabase, config.user_id, String(meetingId));
    if (!isNew) {
      console.log("[Fireflies Webhook] Already processed, skipping");
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }

    // Fetch transcript details via Composio
    const transcript = await fetchTranscriptViaComposio(config.user_id, String(meetingId), supabase);

    // Format memory
    const memoryContent = formatTranscriptAsMemory(transcript, String(meetingId));

    // Save to LIAM
    const saved = await saveMemoryToLiam(supabase, config.user_id, memoryContent);

    if (saved) {
      // Update stats
      await supabase
        .from("fireflies_automation_config")
        .update({
          transcripts_saved: (config.transcripts_saved || 0) + 1,
          last_received_at: new Date().toISOString(),
        })
        .eq("user_id", config.user_id);
    }

    console.log(`[Fireflies Webhook] Memory ${saved ? "saved" : "failed"} for meeting ${meetingId}`);

    return new Response(JSON.stringify({ ok: true, saved }), { status: 200 });
  } catch (err) {
    console.error("[Fireflies Webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500 }
    );
  }
});
