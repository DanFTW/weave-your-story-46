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

async function createMemory(apiKeys: any, content: string): Promise<boolean> {
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

function formatTranscriptAsMemory(transcript: any): string {
  const parts = ["Fireflies Meeting Transcript", ""];

  const title = transcript?.title || transcript?.meeting_title || transcript?.name || "Untitled Meeting";
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

// === WEBHOOK TOKEN GENERATOR ===

function generateToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
    try {
      const connResponse = await fetch(
        `https://backend.composio.dev/api/v1/connected_accounts/${connectionId}`,
        {
          headers: { "x-api-key": COMPOSIO_API_KEY },
        }
      );
      if (connResponse.ok) {
        const connData = await connResponse.json();
        const accessToken = connData?.connectionParams?.access_token || connData?.connectionParams?.headers?.Authorization?.replace("Bearer ", "");

        if (accessToken) {
          const gqlResponse = await fetch("https://api.fireflies.ai/graphql", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              query: "{ transcripts { id title date duration participants organizer_email summary { overview } } }",
            }),
          });

          if (gqlResponse.ok) {
            const gqlData = await gqlResponse.json();
            transcripts = gqlData?.data?.transcripts || [];
          } else {
            console.error("[Fireflies Sync] GraphQL fallback failed:", gqlResponse.status);
          }
        }
      }
    } catch (fallbackErr) {
      console.error("[Fireflies Sync] Fallback error:", fallbackErr);
    }
  }

  console.log(`[Fireflies Sync] Found ${transcripts.length} total transcripts`);

  if (transcripts.length === 0) {
    await supabaseClient
      .from("fireflies_automation_config")
      .update({ last_received_at: new Date().toISOString() })
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

    // Create memory first, only mark processed on success
    if (apiKeys) {
      const memoryContent = formatTranscriptAsMemory(transcript);
      const success = await createMemory(apiKeys, memoryContent);

      if (success) {
        // Only insert into processed table after successful memory save
        await supabaseClient.from("fireflies_processed_transcripts").insert({
          user_id: userId,
          fireflies_transcript_id: transcriptId,
        });
        processed++;
        console.log(`[Fireflies Sync] Memory created for transcript ${transcriptId}`);
      } else {
        console.warn(`[Fireflies Sync] Memory failed for transcript ${transcriptId}, will retry next sync`);
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
