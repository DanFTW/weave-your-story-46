import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function createMemory(apiKeys: any, content: string, tag?: string): Promise<boolean> {
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
      console.error("[Fireflies] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[Fireflies] Error creating memory:", error);
    return false;
  }
}

// === SAFE JSON PARSE ===

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[Fireflies] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
}

// === FORMAT TRANSCRIPT AS MEMORY ===

// Max safe content size per memory chunk (chars). LIAM can handle ~10k comfortably.
const MAX_MEMORY_CHUNK_SIZE = 8000;

function formatTranscriptAsMemory(transcript: any): string[] {
  const title = transcript?.title || transcript?.meeting_title || transcript?.name || "Untitled Meeting";

  // Build metadata header
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

  // Summary section
  if (transcript?.summary) {
    header.push("");
    if (transcript.summary.overview) {
      header.push(`Summary: ${transcript.summary.overview}`);
    }
    if (transcript.summary.action_items && Array.isArray(transcript.summary.action_items) && transcript.summary.action_items.length > 0) {
      header.push("");
      header.push("Action Items:");
      for (const item of transcript.summary.action_items) {
        header.push(`• ${item}`);
      }
    }
    if (transcript.summary.keywords && Array.isArray(transcript.summary.keywords) && transcript.summary.keywords.length > 0) {
      header.push(`Keywords: ${transcript.summary.keywords.join(", ")}`);
    }
  }

  // Full transcript dialogue
  let dialogueText = "";
  const sentences = transcript?.sentences || transcript?.transcript?.sentences;
  if (Array.isArray(sentences) && sentences.length > 0) {
    header.push("");
    header.push("--- Transcript ---");
    header.push("");
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

  // If small enough, return as single chunk
  if (fullContent.length <= MAX_MEMORY_CHUNK_SIZE) {
    return [fullContent];
  }

  // Chunk the dialogue, keeping header in each part
  const chunks: string[] = [];
  const availablePerChunk = MAX_MEMORY_CHUNK_SIZE - headerText.length - 50; // 50 for part label
  const dialogueLines = dialogueText.split("\n");
  let currentChunk: string[] = [];
  let currentLen = 0;

  for (const line of dialogueLines) {
    if (currentLen + line.length + 1 > availablePerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.join("\n"));
      currentChunk = [];
      currentLen = 0;
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

// === WEBHOOK TOKEN GENERATOR ===

function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// === FETCH FULL TRANSCRIPT BY ID ===

async function getAccessToken(connectionId: string): Promise<string | null> {
  try {
    const connResponse = await fetch(
      `https://backend.composio.dev/api/v1/connected_accounts/${connectionId}`,
      { headers: { "x-api-key": COMPOSIO_API_KEY } }
    );
    if (!connResponse.ok) return null;
    const connData = await connResponse.json();
    return connData?.connectionParams?.access_token ||
      connData?.connectionParams?.headers?.Authorization?.replace("Bearer ", "") ||
      null;
  } catch {
    return null;
  }
}

async function fetchFullTranscript(connectionId: string, transcriptId: string): Promise<any | null> {
  // 1. Try Composio FIREFLIES_GET_TRANSCRIPT_BY_ID
  try {
    const response = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/FIREFLIES_GET_TRANSCRIPT_BY_ID",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": COMPOSIO_API_KEY },
        body: JSON.stringify({ connected_account_id: connectionId, arguments: { id: transcriptId } }),
      }
    );

    if (response.ok) {
      const result = await response.json();
      const data = result?.data?.response_data?.transcript || result?.data?.response_data || result?.data || result;
      const sentences = data?.sentences || data?.transcript?.sentences;
      if (Array.isArray(sentences) && sentences.length > 0) {
        console.log(`[Fireflies Sync] Got full transcript via Composio for ${transcriptId} (${sentences.length} sentences)`);
        return data;
      }
      console.warn(`[Fireflies Sync] Composio returned no sentences for ${transcriptId}, trying GraphQL fallback`);
    }
  } catch (err) {
    console.warn(`[Fireflies Sync] Composio GET_TRANSCRIPT_BY_ID failed for ${transcriptId}:`, err);
  }

  // 2. Fallback: direct GraphQL query
  const accessToken = await getAccessToken(connectionId);
  if (!accessToken) {
    console.error(`[Fireflies Sync] No access token available for GraphQL fallback`);
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
        variables: { id: transcriptId },
      }),
    });

    if (gqlResponse.ok) {
      const gqlData = await gqlResponse.json();
      const transcript = gqlData?.data?.transcript;
      if (transcript) {
        const sentences = transcript.sentences;
        console.log(`[Fireflies Sync] Got full transcript via GraphQL for ${transcriptId} (${Array.isArray(sentences) ? sentences.length : 0} sentences)`);
        return transcript;
      }
    } else {
      console.error(`[Fireflies Sync] GraphQL fallback failed for ${transcriptId}: ${gqlResponse.status}`);
    }
  } catch (err) {
    console.error(`[Fireflies Sync] GraphQL fallback error for ${transcriptId}:`, err);
  }

  return null;
}

// === SYNC FIREFLIES TRANSCRIPTS ===

async function syncFirefliesTranscripts(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTranscripts: number; totalSaved: number }> {
  console.log(`[Fireflies Sync] Fetching transcripts for user ${userId}`);

  // Try Composio tool first
  let transcripts: any[] = [];

  const toolResponse = await fetch(
    "https://backend.composio.dev/api/v3/tools/execute/FIREFLIES_LIST_TRANSCRIPTS",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        connected_account_id: connectionId,
        arguments: {},
      }),
    }
  );

  const toolText = await toolResponse.text();
  console.log(`[Fireflies Sync] Composio response status: ${toolResponse.status}`);

  if (toolResponse.ok) {
    const toolData = safeJsonParse(toolText);
    if (toolData) {
      // Extract transcripts defensively from nested Composio response
      if (Array.isArray(toolData.data?.response_data?.transcripts)) {
        transcripts = toolData.data.response_data.transcripts;
      } else if (Array.isArray(toolData.data?.response_data)) {
        transcripts = toolData.data.response_data;
      } else if (Array.isArray(toolData.data?.transcripts)) {
        transcripts = toolData.data.transcripts;
      } else if (Array.isArray(toolData.data)) {
        transcripts = toolData.data;
      } else if (Array.isArray(toolData.response_data?.transcripts)) {
        transcripts = toolData.response_data.transcripts;
      } else if (Array.isArray(toolData.response_data)) {
        transcripts = toolData.response_data;
      } else if (Array.isArray(toolData.transcripts)) {
        transcripts = toolData.transcripts;
      }
    }
  } else {
    console.warn("[Fireflies Sync] Composio tool failed, trying direct GraphQL fallback");
    console.warn("[Fireflies Sync] Composio error:", toolText.slice(0, 500));

    // Fallback: get the access token from Composio connection metadata
    const accessToken = await getAccessToken(connectionId);
    if (accessToken) {
      try {
        const gqlResponse = await fetch("https://api.fireflies.ai/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            query: "{ transcripts { id title date duration participants organizer_email sentences { text speaker_name } summary { overview action_items keywords } } }",
          }),
        });

        if (gqlResponse.ok) {
          const gqlData = await gqlResponse.json();
          transcripts = gqlData?.data?.transcripts || [];
        } else {
          console.error("[Fireflies Sync] GraphQL fallback failed:", gqlResponse.status);
        }
      } catch (fallbackErr) {
        console.error("[Fireflies Sync] Fallback error:", fallbackErr);
      }
    }
  }

  console.log(`[Fireflies Sync] Found ${transcripts.length} total transcripts`);

  if (transcripts.length === 0) {
    await supabaseClient
      .from("fireflies_automation_config")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { newTranscripts: 0, totalSaved: 0 };
  }

  // Check which transcripts are already processed
  const transcriptIds = transcripts.map((t: any) => String(t.id));
  const { data: existing } = await supabaseClient
    .from("fireflies_processed_transcripts")
    .select("fireflies_transcript_id")
    .eq("user_id", userId)
    .in("fireflies_transcript_id", transcriptIds);

  const existingIds = new Set((existing || []).map((e: any) => e.fireflies_transcript_id));
  const newTranscripts = transcripts.filter((t: any) => !existingIds.has(String(t.id)));

  console.log(`[Fireflies Sync] ${newTranscripts.length} new transcripts to process`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let processed = 0;

  // Process in batches of 10 with 500ms delay
  for (let i = 0; i < newTranscripts.length; i++) {
    const transcript = newTranscripts[i];
    const transcriptId = String(transcript.id);

    // Fetch full transcript details (sentences + summary) per-transcript
    const hasSentences = Array.isArray(transcript.sentences) && transcript.sentences.length > 0;
    const fullTranscript = hasSentences ? transcript : await fetchFullTranscript(connectionId, transcriptId);
    const transcriptToFormat = fullTranscript || transcript; // graceful degradation

    // Create memory first, only mark processed on success
    if (apiKeys) {
      const memoryChunks = formatTranscriptAsMemory(transcriptToFormat);
      let allChunksSaved = true;

      for (const chunk of memoryChunks) {
        const success = await createMemory(apiKeys, chunk, "FIREFLIES");
        if (!success) {
          allChunksSaved = false;
          console.warn(`[Fireflies Sync] Memory chunk failed for transcript ${transcriptId}, will retry next sync`);
          break;
        }
      }

      if (allChunksSaved) {
        await supabaseClient.from("fireflies_processed_transcripts").insert({
          user_id: userId,
          fireflies_transcript_id: transcriptId,
        });
        processed++;
        console.log(`[Fireflies Sync] Memory created (${memoryChunks.length} chunk(s)) for transcript ${transcriptId}`);
      }
    }

    // Rate limit: 500ms between memory creations every 10 items
    if (i < newTranscripts.length - 1 && i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Update stats
  const { data: currentConfig } = await supabaseClient
    .from("fireflies_automation_config")
    .select("transcripts_saved")
    .eq("user_id", userId)
    .maybeSingle();

  const newTotal = (currentConfig?.transcripts_saved || 0) + processed;

  await supabaseClient
    .from("fireflies_automation_config")
    .update({
      transcripts_saved: newTotal,
      last_received_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { newTranscripts: processed, totalSaved: newTotal };
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action } = body;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    console.log(`[Fireflies Triggers] Action: ${action}, User: ${userId}`);

    // Get user's Fireflies connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "fireflies")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Fireflies not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    // === ACTIVATE ===
    if (action === "activate") {
      // Ensure config row exists
      const { data: existing } = await supabaseClient
        .from("fireflies_automation_config")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const webhookToken = existing?.webhook_token || generateToken();
      const webhookSecret = existing?.webhook_secret || generateToken(16);

      if (existing) {
        await supabaseClient
          .from("fireflies_automation_config")
          .update({
            is_active: true,
            webhook_token: webhookToken,
            webhook_secret: webhookSecret,
          })
          .eq("user_id", userId);
      } else {
        await supabaseClient
          .from("fireflies_automation_config")
          .insert({
            user_id: userId,
            is_active: true,
            webhook_token: webhookToken,
            webhook_secret: webhookSecret,
          });
      }

      const webhookUrl = `${SUPABASE_URL}/functions/v1/fireflies-webhook/${webhookToken}`;

      // Run initial sync to backfill existing transcripts
      const syncResult = await syncFirefliesTranscripts(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({
          success: true,
          webhookUrl,
          webhookSecret,
          webhookToken,
          ...syncResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE ===
    if (action === "deactivate") {
      await supabaseClient
        .from("fireflies_automation_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL POLL ===
    if (action === "manual-poll") {
      console.log(`[Fireflies Triggers] Manual poll for user ${userId}`);

      const result = await syncFirefliesTranscripts(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Fireflies Triggers] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
