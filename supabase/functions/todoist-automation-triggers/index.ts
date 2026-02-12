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

// === TODOIST API: Get access token from Composio ===

async function getTodoistAccessToken(connectionId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts/${connectionId}`,
      { method: "GET", headers: { "x-api-key": COMPOSIO_API_KEY } }
    );
    if (!response.ok) {
      console.error("[Todoist] Failed to fetch connected account:", response.status);
      return null;
    }
    const data = await response.json();
    const token =
      data?.data?.connection_params?.access_token ||
      data?.data?.access_token ||
      data?.connection_params?.access_token ||
      data?.access_token ||
      null;
    if (!token) console.error("[Todoist] No access token found. Keys:", Object.keys(data?.data || data));
    return token;
  } catch (error) {
    console.error("[Todoist] Error fetching access token:", error);
    return null;
  }
}

// === TODOIST API: Fetch tasks ===

async function fetchTodoistTasks(connectionId: string): Promise<any[]> {
  try {
    const accessToken = await getTodoistAccessToken(connectionId);
    if (!accessToken) return [];

    const response = await fetch("https://api.todoist.com/rest/v2/tasks", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Todoist] API error:", response.status, errText.slice(0, 500));
      return [];
    }

    const tasks = await response.json();
    console.log(`[Todoist] Fetched ${tasks.length} tasks`);
    return tasks;
  } catch (error) {
    console.error("[Todoist] Error fetching tasks:", error);
    return [];
  }
}

// === POLLING LOGIC ===

async function pollTodoistTasks(
  supabaseClient: any,
  userId: string,
  connectionId: string
): Promise<{ newTasks: number; error?: string }> {
  try {
    console.log(`[Todoist Poll] Processing user ${userId}`);

    const { data: apiKeys } = await supabaseClient
      .from("user_api_keys")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const tasks = await fetchTodoistTasks(connectionId);
    if (tasks.length === 0) return { newTasks: 0 };

    const { data: config } = await supabaseClient
      .from("todoist_automation_config")
      .select("tasks_tracked")
      .eq("user_id", userId)
      .maybeSingle();

    const currentCount = config?.tasks_tracked || 0;
    let newTasksCount = 0;

    for (const task of tasks) {
      const taskId = task.id;
      if (!taskId) continue;

      const { data: existing } = await supabaseClient
        .from("todoist_processed_tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("todoist_task_id", String(taskId))
        .maybeSingle();

      if (existing) continue;

      await supabaseClient.from("todoist_processed_tasks").insert({
        user_id: userId,
        todoist_task_id: String(taskId),
      });

      newTasksCount++;
      console.log(`[Todoist Poll] New task: ${task.content}`);

      if (apiKeys) {
        const memoryContent = formatTaskAsMemory(task);
        const success = await createMemory(apiKeys, memoryContent);
        console.log(`[Todoist Poll] Memory ${success ? 'created' : 'failed'} for: ${task.content}`);
      }
    }

    await supabaseClient
      .from("todoist_automation_config")
      .update({ tasks_tracked: currentCount + newTasksCount })
      .eq("user_id", userId);

    console.log(`[Todoist Poll] Processed ${newTasksCount} new tasks`);
    return { newTasks: newTasksCount };
  } catch (err) {
    console.error("[Todoist Poll] Error:", err);
    return { newTasks: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// === MAIN HANDLER ===

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
    const { action } = await req.json();
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
      console.log(`[Todoist Triggers] Activating polling mode for user ${userId}`);

      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: true, trigger_id: null })
        .eq("user_id", userId);

      // Run initial poll
      const pollResult = await pollTodoistTasks(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, mode: "polling", initialPoll: pollResult }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate") {
      await supabaseClient
        .from("todoist_automation_config")
        .update({ is_active: false, trigger_id: null })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "manual-poll") {
      console.log(`[Todoist Triggers] Manual poll for user ${userId}`);
      const pollResult = await pollTodoistTasks(supabaseClient, userId, connectionId);

      return new Response(
        JSON.stringify({ success: true, newItems: pollResult.newTasks, error: pollResult.error }),
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
