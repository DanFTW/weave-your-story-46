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
      console.error("[Todoist] LIAM API error:", response.status, errorText);
    }
    return response.ok;
  } catch (error) {
    console.error("[Todoist] Error creating memory:", error);
    return false;
  }
}

// Format task as memory
function formatTaskAsMemory(task: any): string {
  const parts = ["Todoist Task Created", ""];
  if (task.content) parts.push(`Task: ${task.content}`);
  if (task.project_name || task.project) parts.push(`Project: ${task.project_name || task.project}`);
  if (task.priority) parts.push(`Priority: ${task.priority}`);
  if (task.due?.date || task.due_date) parts.push(`Due: ${task.due?.date || task.due_date}`);
  parts.push("");
  parts.push("A new task was added to your Todoist.");
  return parts.join("\n");
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

    // === WEBHOOK HANDLER (from Composio trigger) ===
    if (!action) {
      console.log("[Todoist Webhook] Received event payload");

      // Extract task data from Composio webhook payload
      const taskData = body.payload || body.data || body;
      const taskId = taskData.id || taskData.task_id || taskData.content?.id;
      
      if (!taskId) {
        console.error("[Todoist Webhook] No task ID found in payload:", JSON.stringify(body).slice(0, 500));
        return new Response(JSON.stringify({ error: "No task ID in payload" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the user by looking up the trigger
      const triggerId = body.trigger_id || body.triggerId;
      let userId: string | null = null;

      if (triggerId) {
        const { data: configData } = await supabaseClient
          .from("todoist_automation_config")
          .select("user_id")
          .eq("trigger_id", triggerId)
          .eq("is_active", true)
          .maybeSingle();
        userId = configData?.user_id || null;
      }

      // Fallback: try connected_account_id
      if (!userId && (body.connected_account_id || body.connectionId)) {
        const connId = body.connected_account_id || body.connectionId;
        const { data: integration } = await supabaseClient
          .from("user_integrations")
          .select("user_id")
          .eq("composio_connection_id", connId)
          .eq("integration_id", "todoist")
          .eq("status", "connected")
          .maybeSingle();
        userId = integration?.user_id || null;
      }

      if (!userId) {
        console.error("[Todoist Webhook] Could not resolve user from trigger/connection");
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduplication check
      const { data: existing } = await supabaseClient
        .from("todoist_processed_tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("todoist_task_id", String(taskId))
        .maybeSingle();

      if (existing) {
        console.log("[Todoist Webhook] Task already processed:", taskId);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as processed
      await supabaseClient.from("todoist_processed_tasks").insert({
        user_id: userId,
        todoist_task_id: String(taskId),
      });

      // Get user API keys for LIAM
      const { data: apiKeys } = await supabaseClient
        .from("user_api_keys")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (apiKeys) {
        const memoryContent = formatTaskAsMemory(taskData);
        const success = await createMemory(apiKeys, memoryContent);
        console.log(`[Todoist Webhook] Memory creation ${success ? 'succeeded' : 'failed'} for task ${taskId}`);
      }

      // Increment tasks_tracked
      const { data: currentConfig } = await supabaseClient
        .from("todoist_automation_config")
        .select("tasks_tracked")
        .eq("user_id", userId)
        .maybeSingle();

      await supabaseClient
        .from("todoist_automation_config")
        .update({ tasks_tracked: (currentConfig?.tasks_tracked || 0) + 1 })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === USER ACTIONS (activate/deactivate) - require auth ===
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
    console.log(`[Todoist Triggers] Action: ${action}, User: ${userId}`);

    // Get user's Todoist connection
    const { data: integration } = await supabaseClient
      .from("user_integrations")
      .select("composio_connection_id")
      .eq("user_id", userId)
      .eq("integration_id", "todoist")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration?.composio_connection_id) {
      return new Response(JSON.stringify({ error: "Todoist not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectionId = integration.composio_connection_id;

    if (action === "activate") {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/todoist-automation-triggers`;

      console.log(`[Todoist Triggers] Creating event trigger TODOIST_NEW_TASK_CREATED`);
      console.log(`[Todoist Triggers] Connection ID: ${connectionId}`);
      console.log(`[Todoist Triggers] Webhook URL: ${webhookUrl}`);

      const triggerResponse = await fetch(
        "https://backend.composio.dev/api/v3/trigger_instances/TODOIST_NEW_TASK_CREATED/upsert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            trigger_config: {},
            webhook_url: webhookUrl,
          }),
        }
      );

      const triggerText = await triggerResponse.text();
      console.log(`[Todoist Triggers] Composio response: ${triggerResponse.status} ${triggerText}`);

      if (!triggerResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to create trigger", details: triggerText }),
          { status: triggerResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let triggerData;
      try { triggerData = JSON.parse(triggerText); } catch { triggerData = {}; }
      const triggerId = triggerData?.trigger_id || triggerData?.id || null;

      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: true, trigger_id: triggerId })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, triggerId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate") {
      // Get trigger ID to delete
      const { data: config } = await supabaseClient
        .from("todoist_automation_config")
        .select("trigger_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (config?.trigger_id) {
        console.log(`[Todoist Triggers] Deleting trigger: ${config.trigger_id}`);
        try {
          await fetch(
            `https://backend.composio.dev/api/v3/trigger_instances/${config.trigger_id}`,
            {
              method: "DELETE",
              headers: { "x-api-key": COMPOSIO_API_KEY },
            }
          );
        } catch (err) {
          console.error("[Todoist Triggers] Error deleting trigger:", err);
        }
      }

      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: false, trigger_id: null })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Todoist Triggers] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
