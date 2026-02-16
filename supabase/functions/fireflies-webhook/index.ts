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

// === VERIFY FIREFLIES SIGNATURE (x-hub-signature) ===

async function verifyFirefliesSignature(rawBody: string, secret: string, signatureHeader: string | null): Promise<boolean> {
  // If a secret is configured, signature verification is mandatory
  if (!signatureHeader) {
    console.error("[Fireflies Webhook] Missing x-hub-signature header while secret is configured");
    return false;
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
    const computed = "sha256=" + Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");

    // Compare: Fireflies sends "sha256=<hex>" format
    const headerValue = signatureHeader.startsWith("sha256=") ? signatureHeader : `sha256=${signatureHeader}`;
    return computed === headerValue;
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

// === GET ACCESS TOKEN ===

async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connResponse = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      { headers: { "x-api-key": COMPOSIO_API_KEY } }
    );
    if (!connResponse.ok) {
      console.error(`[Fireflies Webhook] Failed to fetch connected account: ${connResponse.status}`);
      return null;
    }
    const connData = await connResponse.json();
    const data = connData?.data || connData;

    const accessToken =
      data?.connection_params?.access_token ||
      data?.access_token ||
      data?.connectionParams?.access_token ||
      data?.connectionParams?.headers?.Authorization?.replace("Bearer ", "") ||
      null;

    if (!accessToken) {
      console.error("[Fireflies Webhook] No access token found. Keys:", Object.keys(data || {}));
    }
    return accessToken;
  } catch (err) {
    console.error("[Fireflies Webhook] Error fetching access token:", err);
    return null;
  }
}

// === FETCH TRANSCRIPT VIA COMPOSIO (with GraphQL fallback) ===

async function fetchTranscriptViaComposio(userId: string, meetingId: string, supabase: any) {
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

  const connectionId = integration.composio_connection_id;

  // 1. Try Composio tool
  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/FIREFLIES_GET_TRANSCRIPT_BY_ID",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
        body: JSON.stringify({ connected_account_id: connectionId, arguments: { id: meetingId } }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      const data = result?.data?.response_data?.transcript || result?.data?.response_data || result?.data || result;
      const sentences = data?.sentences || data?.transcript?.sentences;
      if (Array.isArray(sentences) && sentences.length > 0) {
        console.log(`[Fireflies Webhook] Got full transcript via Composio (${sentences.length} sentences)`);
        return data;
      }
      console.warn("[Fireflies Webhook] Composio returned no sentences, trying GraphQL fallback");
    }
  } catch (err) {
    console.warn("[Fireflies Webhook] Composio fetch error:", err);
  }

  // 2. Fallback: direct GraphQL
  const accessToken = await getAccessToken(connectionId);
  if (!accessToken) {
    console.error("[Fireflies Webhook] No access token for GraphQL fallback");
    return null;
  }

  try {
    const gqlResponse = await fetch("https://api.fireflies.ai/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
      body: JSON.stringify({
        query: `query Transcript($id: String!) {
          transcript(id: $id) {
            id title date duration participants organizer_email
            sentences { text speaker_name }
            summary { overview action_items keywords }
          }
        }`,
        variables: { id: meetingId },
      }),
    });

    if (gqlResponse.ok) {
      const gqlData = await gqlResponse.json();
      const transcript = gqlData?.data?.transcript;
      if (transcript) {
        console.log(`[Fireflies Webhook] Got full transcript via GraphQL (${Array.isArray(transcript.sentences) ? transcript.sentences.length : 0} sentences)`);
        return transcript;
      }
    } else {
      console.error("[Fireflies Webhook] GraphQL fallback failed:", gqlResponse.status);
    }
  } catch (err) {
    console.error("[Fireflies Webhook] GraphQL fallback error:", err);
  }

  return null;
}

// === FORMAT TRANSCRIPT AS MEMORY ===

const MAX_MEMORY_CHUNK_SIZE = 8000;

function formatTranscriptAsMemory(transcript: any, meetingId: string): string[] {
  const title = transcript?.title || transcript?.meeting_title || `Meeting ${meetingId}`;

  const header: string[] = ["Fireflies Meeting Transcript", ""];
  header.push(`Title: ${title}`);
  if (transcript?.date || transcript?.dateString) {
    header.push(`Date: ${transcript.date || transcript.dateString}`);
  }
  if (transcript?.duration) {
    const mins = Math.round(transcript.duration / 60);
    header.push(`Duration: ${mins} minutes`);
  }
  if (transcript?.participants && Array.isArray(transcript.participants)) {
    header.push(`Participants: ${transcript.participants.join(", ")}`);
  } else if (transcript?.organizer_email) {
    header.push(`Organizer: ${transcript.organizer_email}`);
  }

  if (transcript?.summary) {
    header.push("");
    if (transcript.summary.overview) header.push(`Summary: ${transcript.summary.overview}`);
    if (Array.isArray(transcript.summary.action_items) && transcript.summary.action_items.length > 0) {
      header.push(""); header.push("Action Items:");
      for (const item of transcript.summary.action_items) header.push(`• ${item}`);
    }
    if (Array.isArray(transcript.summary.keywords) && transcript.summary.keywords.length > 0) {
      header.push(`Keywords: ${transcript.summary.keywords.join(", ")}`);
    }
  }

  let dialogueText = "";
  const sentences = transcript?.sentences || transcript?.transcript?.sentences;
  if (Array.isArray(sentences) && sentences.length > 0) {
    header.push(""); header.push("--- Transcript ---"); header.push("");
    const lines: string[] = [];
    for (const s of sentences) {
      const speaker = s.speaker_name || s.speaker || "Unknown";
      const text = s.text || s.raw_text || "";
      if (text.trim()) lines.push(`${speaker}: ${text.trim()}`);
    }
    dialogueText = lines.join("\n");
  }

  const headerText = header.join("\n");
  const fullContent = dialogueText ? `${headerText}\n${dialogueText}` : headerText;

  if (fullContent.length <= MAX_MEMORY_CHUNK_SIZE) return [fullContent];

  const chunks: string[] = [];
  const availablePerChunk = MAX_MEMORY_CHUNK_SIZE - headerText.length - 50;
  const dialogueLines = dialogueText.split("\n");
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (const line of dialogueLines) {
    if (currentLen + line.length + 1 > availablePerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = []; currentLen = 0;
    }
    currentChunk.push(line);
    currentLen += line.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk.join("\n"));

  const totalParts = chunks.length;
  return chunks.map((chunk, i) => {
    const partLabel = `(Part ${i + 1}/${totalParts})`;
    const partHeader = headerText.replace("Fireflies Meeting Transcript", `Fireflies Meeting Transcript ${partLabel}`);
    return `${partHeader}\n${chunk}`;
  });
}

// === SAVE MEMORY TO LIAM ===

async function saveMemoryToLiam(supabase: any, userId: string, content: string, tag?: string): Promise<boolean> {
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
    const body: any = { userKey: apiKeys.user_key, content };
    if (tag) body.tag = tag;
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

    // Verify signature using x-hub-signature header (Fireflies standard)
    if (config.webhook_secret) {
      const signatureHeader = req.headers.get("x-hub-signature");
      const isValid = await verifyFirefliesSignature(rawBody, config.webhook_secret, signatureHeader);
      if (!isValid) {
        console.error("[Fireflies Webhook] Invalid or missing signature");
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
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

    // Fetch transcript details via Composio
    const transcript = await fetchTranscriptViaComposio(config.user_id, String(meetingId), supabase);

    // Format memory (may return multiple chunks for large transcripts)
    const memoryChunks = formatTranscriptAsMemory(transcript, String(meetingId));

    // Save all chunks to LIAM
    let saved = true;
    for (const chunk of memoryChunks) {
      const chunkSaved = await saveMemoryToLiam(supabase, config.user_id, chunk, "FIREFLIES");
      if (!chunkSaved) { saved = false; break; }
    }

    if (saved) {
      // Only mark as processed after successful memory save (retry-safe)
      const { error: dedupError } = await supabase
        .from("fireflies_processed_transcripts")
        .insert({ user_id: config.user_id, fireflies_transcript_id: String(meetingId) });

      if (dedupError && dedupError.code === "23505") {
        console.log("[Fireflies Webhook] Already processed (duplicate delivery), memory saved anyway");
      }

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
