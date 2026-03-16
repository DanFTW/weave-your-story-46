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

// === FORMAT TASK AS MEMORY ===

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

// === SAFE JSON PARSE ===

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    console.error("[Todoist] Failed to parse JSON:", text.slice(0, 200));
    return null;
  }
}

// === POLL TODOIST VIA COMPOSIO TOOL ===

async function pollTodoistTasks(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTasks: number; totalTracked: number }> {
  console.log(`[Todoist Poll] Fetching tasks for user ${userId}`);

  // Execute Composio tool to get all tasks
  const toolResponse = await fetch(
    "https://backend.composio.dev/api/v3/tools/execute/TODOIST_GET_ALL_TASKS",
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
  console.log(`[Todoist Poll] Composio response status: ${toolResponse.status}`);

  if (!toolResponse.ok) {
    console.error("[Todoist Poll] Composio tool error:", toolText.slice(0, 500));
    throw new Error(`Composio tool execution failed: ${toolResponse.status}`);
  }

  const toolData = safeJsonParse(toolText);
  if (!toolData) {
    throw new Error("Failed to parse Composio tool response");
  }

  // Extract tasks from response - Composio wraps results in various formats
  let tasks: any[] = [];
  const rd = toolData.data?.response_data;

  // Diagnostic logging for response structure
  console.log('[Todoist Poll] Composio response structure keys:', Object.keys(toolData.data || {}));
  if (rd) console.log('[Todoist Poll] Composio response_data keys:', Object.keys(rd));

  if (Array.isArray(rd?.data)) {
    tasks = rd.data;
  } else if (Array.isArray(rd)) {
    tasks = rd;
  } else if (rd?.tasks && Array.isArray(rd.tasks)) {
    tasks = rd.tasks;
  } else if (toolData.data?.tasks && Array.isArray(toolData.data.tasks)) {
    tasks = toolData.data.tasks;
  } else if (Array.isArray(toolData.data?.data)) {
    tasks = toolData.data.data;
  } else if (Array.isArray(toolData.data)) {
    tasks = toolData.data;
  } else if (toolData.response_data?.tasks && Array.isArray(toolData.response_data.tasks)) {
    tasks = toolData.response_data.tasks;
  } else if (Array.isArray(toolData.response_data)) {
    tasks = toolData.response_data;
  }

  if (tasks.length === 0) {
    console.warn('[Todoist Poll] Found 0 total tasks. Raw response snippet:', JSON.stringify(toolData).substring(0, 1000));
  } else {
    console.log(`[Todoist Poll] Found ${tasks.length} total tasks`);
  }

  if (tasks.length === 0) {
    // Update last_polled_at even if no tasks
    await supabaseClient
      .from("todoist_automation_config")
      .update({ last_polled_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { newTasks: 0, totalTracked: 0 };
  }

  // Check which tasks are already processed
  const taskIds = tasks.map((t: any) => String(t.id));
  const { data: existing } = await supabaseClient
    .from("todoist_processed_tasks")
    .select("todoist_task_id")
    .eq("user_id", userId)
    .in("todoist_task_id", taskIds);

  const existingIds = new Set((existing || []).map((e: any) => e.todoist_task_id));
  const newTasks = tasks.filter((t: any) => !existingIds.has(String(t.id)));

  console.log(`[Todoist Poll] ${newTasks.length} new tasks to process`);

  // Get user API keys for LIAM
  const { data: apiKeys } = await supabaseClient
    .from("user_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let processed = 0;
  // Process in batches of 10 with 500ms delay
  for (let i = 0; i < newTasks.length; i++) {
    const task = newTasks[i];
    const taskId = String(task.id);

    // Insert into processed tasks
    await supabaseClient.from("todoist_processed_tasks").insert({
      user_id: userId,
      todoist_task_id: taskId,
    });

    // Create memory
    if (apiKeys) {
      const memoryContent = formatTaskAsMemory(task);
      const success = await createMemory(apiKeys, memoryContent);
      if (success) processed++;
      console.log(`[Todoist Poll] Memory ${success ? 'created' : 'failed'} for task ${taskId}`);
    }

    // Rate limit: 500ms between memory creations
    if (i < newTasks.length - 1 && i % 10 === 9) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Update stats
  const { data: currentConfig } = await supabaseClient
    .from("todoist_automation_config")
    .select("tasks_tracked")
    .eq("user_id", userId)
    .maybeSingle();

  const newTotal = (currentConfig?.tasks_tracked || 0) + processed;

  await supabaseClient
    .from("todoist_automation_config")
    .update({
      tasks_tracked: newTotal,
      last_polled_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { newTasks: processed, totalTracked: newTotal };
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

    // All actions require authentication
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

    // === ACTIVATE ===
    if (action === "activate") {
      console.log(`[Todoist Triggers] Activating for user ${userId}`);

      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: true, trigger_id: null })
        .eq("user_id", userId);

      // Run initial poll
      const result = await pollTodoistTasks(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === DEACTIVATE ===
    if (action === "deactivate") {
      console.log(`[Todoist Triggers] Deactivating for user ${userId}`);

      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: false, trigger_id: null })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === MANUAL POLL ===
    if (action === "manual-poll") {
      console.log(`[Todoist Triggers] Manual poll for user ${userId}`);

      const result = await pollTodoistTasks(supabaseClient, userId, connectionId);

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
    console.error("[Todoist Triggers] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
