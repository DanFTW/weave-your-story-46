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

async function getConnectionId(sb: any, userId: string, integrationId: string): Promise<string | null> {
  const { data } = await sb
    .from("user_integrations")
    .select("composio_connection_id")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .eq("status", "connected")
    .maybeSingle();
  return data?.composio_connection_id ?? null;
}

// ── AI Receipt Parsing ──

interface ParsedReceipt {
  isReceipt: boolean;
  date: string;
  vendor: string;
  amount: string;
}

async function parseEmailForReceipt(emailBody: string): Promise<ParsedReceipt> {
  if (!LOVABLE_API_KEY) {
    console.error("[ReceiptSheet] LOVABLE_API_KEY not configured");
    return { isReceipt: false, date: "", vendor: "", amount: "" };
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
            content:
              "You extract purchase/receipt data from emails. Only detect actual purchase confirmations, order confirmations, or receipts. Do not include newsletters, promotions, or shipping updates without a total amount.",
          },
          {
            role: "user",
            content: `Extract purchase receipt data from this email. If it is not a purchase receipt/confirmation, set isReceipt to false.\n\nEmail:\n"${emailBody.slice(0, 3000)}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_receipt",
              description: "Extract receipt data from an email",
              parameters: {
                type: "object",
                properties: {
                  isReceipt: {
                    type: "boolean",
                    description: "Whether this email is a purchase receipt/confirmation",
                  },
                  date: {
                    type: "string",
                    description: "Purchase date in YYYY-MM-DD format, or empty if unknown",
                  },
                  vendor: {
                    type: "string",
                    description: "Store/vendor/merchant name",
                  },
                  amount: {
                    type: "string",
                    description: "Total amount with currency symbol (e.g. $29.99)",
                  },
                },
                required: ["isReceipt", "date", "vendor", "amount"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_receipt" } },
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error("[ReceiptSheet] AI error:", res.status);
      return { isReceipt: false, date: "", vendor: "", amount: "" };
    }

    const json = await res.json();
    const toolCall = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments);
    }

    return { isReceipt: false, date: "", vendor: "", amount: "" };
  } catch (e) {
    console.error("[ReceiptSheet] Parse error:", e);
    return { isReceipt: false, date: "", vendor: "", amount: "" };
  }
}

// ── Append rows to Google Sheet via Composio ──

async function appendToSheet(
  connectionId: string,
  spreadsheetId: string,
  rows: string[][],
): Promise<boolean> {
  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_BATCH_UPDATE",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": COMPOSIO_API_KEY,
        },
        body: JSON.stringify({
          connected_account_id: connectionId,
          arguments: {
            spreadsheet_id: spreadsheetId,
            sheet_name: "Sheet1",
            values: rows,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ReceiptSheet] Composio BATCH_UPDATE error ${res.status}:`, errText);
      return false;
    }

    console.log(`[ReceiptSheet] Appended ${rows.length} rows to sheet`);
    return true;
  } catch (e) {
    console.error("[ReceiptSheet] Append error:", e);
    return false;
  }
}

// ── LIAM Memory helpers (same pattern as gmail-purchase-tracker) ──

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
      console.error("[ReceiptSheet] LIAM save error:", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ReceiptSheet] LIAM save error:", e);
    return false;
  }
}

// ── Fetch emails via Composio ──

async function fetchReceiptEmails(connectionId: string): Promise<any[]> {
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
          arguments: {
            query: "subject:(receipt OR order confirmation OR purchase OR invoice OR payment) newer_than:7d",
            max_results: 20,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[ReceiptSheet] GMAIL_FETCH_EMAILS error ${res.status}:`, errText);
      return [];
    }

    const data = await res.json();
    console.log("[ReceiptSheet] Raw Gmail response keys:", JSON.stringify(data).slice(0, 1500));

    // Navigate nested Composio v3 response
    const innerData = data?.data?.response_data ?? data?.response_data ?? data?.data ?? data;
    const messages = innerData?.messages ?? innerData?.emails ?? innerData?.data?.messages ?? 
                     innerData?.data?.emails ?? (Array.isArray(innerData) ? innerData : []);

    return Array.isArray(messages) ? messages : [];
  } catch (e) {
    console.error("[ReceiptSheet] Fetch emails error:", e);
    return [];
  }
}

// ── Main Handler ──

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
      await sb
        .from("email_receipt_sheet_config")
        .update({ is_active: true })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE ──
    if (action === "deactivate") {
      await sb
        .from("email_receipt_sheet_config")
        .update({ is_active: false })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE-CONFIG ──
    if (action === "update-config") {
      const { spreadsheetId, spreadsheetName } = params;
      await sb
        .from("email_receipt_sheet_config")
        .update({ spreadsheet_id: spreadsheetId, spreadsheet_name: spreadsheetName })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST-SPREADSHEETS ──
    if (action === "list-spreadsheets") {
      const connectionId = await getConnectionId(sb, userId, "googlesheets");
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_SEARCH_SPREADSHEETS",
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
        },
      );

      const raw = await res.text();
      if (!res.ok) {
        console.error(`[ReceiptSheet] List spreadsheets error ${res.status}:`, raw);
        return new Response(JSON.stringify({ spreadsheets: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const data = JSON.parse(raw);
        const innerData = data?.data?.response_data ?? data?.response_data ?? data?.data ?? data;
        const files = innerData?.files ?? innerData?.items ?? innerData?.spreadsheets ?? (Array.isArray(innerData) ? innerData : []);
        const spreadsheets = (Array.isArray(files) ? files : []).map((f: any) => ({
          id: f.id ?? f.spreadsheetId ?? f.spreadsheet_id,
          name: f.name ?? f.properties?.title ?? f.title ?? "Untitled",
        })).filter((s: any) => s.id);

        return new Response(JSON.stringify({ spreadsheets }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("[ReceiptSheet] Failed to parse spreadsheets response:", e);
        return new Response(JSON.stringify({ spreadsheets: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── CREATE-SPREADSHEET ──
    if (action === "create-spreadsheet") {
      const connectionId = await getConnectionId(sb, userId, "googlesheets");
      if (!connectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        "https://backend.composio.dev/api/v3/tools/execute/GOOGLESHEETS_CREATE_GOOGLE_SHEET1",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": COMPOSIO_API_KEY,
          },
          body: JSON.stringify({
            connected_account_id: connectionId,
            arguments: { title: "Weave — Expense Tracker" },
          }),
        },
      );

      const raw = await res.text();
      if (!res.ok) {
        console.error(`[ReceiptSheet] Create spreadsheet error ${res.status}:`, raw);
        return new Response(JSON.stringify({ error: "Failed to create spreadsheet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const data = JSON.parse(raw);
        const innerData = data?.data?.response_data ?? data?.response_data ?? data?.data ?? data;
        const spreadsheetId =
          innerData?.spreadsheet_id ?? innerData?.spreadsheetId ?? innerData?.id ??
          data?.data?.spreadsheet_id ?? data?.spreadsheet_id ?? data?.spreadsheetId ?? data?.id;
        const spreadsheetName =
          innerData?.properties?.title ?? innerData?.title ?? innerData?.name ??
          data?.data?.properties?.title ?? "Weave — Expense Tracker";

        if (!spreadsheetId) {
          return new Response(JSON.stringify({ error: "Spreadsheet created but ID not returned" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Add headers row: Date | Vendor | Amount
        await appendToSheet(connectionId, spreadsheetId, [["Date", "Vendor", "Amount"]]);

        return new Response(JSON.stringify({ spreadsheetId, spreadsheetName }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse create response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── MANUAL-SYNC ──
    if (action === "manual-sync") {
      const { data: cfg } = await sb
        .from("email_receipt_sheet_config")
        .select("spreadsheet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!cfg?.spreadsheet_id) {
        return new Response(JSON.stringify({ error: "No spreadsheet configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const gmailConnectionId = await getConnectionId(sb, userId, "gmail");
      if (!gmailConnectionId) {
        return new Response(JSON.stringify({ error: "Gmail not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sheetsConnectionId = await getConnectionId(sb, userId, "googlesheets");
      if (!sheetsConnectionId) {
        return new Response(JSON.stringify({ error: "Google Sheets not connected" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch receipt emails from Gmail
      const emails = await fetchReceiptEmails(gmailConnectionId);
      console.log(`[ReceiptSheet] Fetched ${emails.length} candidate emails`);

      if (emails.length === 0) {
        return new Response(JSON.stringify({ processed: 0, posted: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get already-processed email IDs
      const { data: existing } = await sb
        .from("email_receipt_sheet_processed")
        .select("email_message_id")
        .eq("user_id", userId);
      const processedIds = new Set((existing || []).map((e: any) => e.email_message_id));

      // Extract message IDs and bodies
      const candidates = emails
        .map((e: any) => ({
          messageId: e.id ?? e.messageId ?? e.message_id ?? "",
          body: e.body ?? e.snippet ?? e.text ?? e.content ?? e.data ?? "",
          subject: e.subject ?? "",
        }))
        .filter((e: any) => e.messageId && !processedIds.has(e.messageId));

      console.log(`[ReceiptSheet] ${candidates.length} unprocessed emails to check`);

      // Fetch LIAM API keys for memory saving
      const { data: apiKeys } = await sb
        .from("user_api_keys")
        .select("api_key, private_key, user_key")
        .eq("user_id", userId)
        .maybeSingle();

      let totalPosted = 0;
      let processed = 0;

      for (const email of candidates) {
        try {
          const emailText = email.subject ? `Subject: ${email.subject}\n\n${email.body}` : email.body;
          const parsed = await parseEmailForReceipt(emailText);
          processed++;

          // Record as processed regardless
          await sb.from("email_receipt_sheet_processed").insert({
            user_id: userId,
            email_message_id: email.messageId,
            vendor: parsed.isReceipt ? parsed.vendor : null,
            amount: parsed.isReceipt ? parsed.amount : null,
            date_str: parsed.isReceipt ? parsed.date : null,
          }).onConflict("user_id,email_message_id");

          if (!parsed.isReceipt) continue;

          // Append to sheet
          const row = [parsed.date || new Date().toISOString().split("T")[0], parsed.vendor, parsed.amount];
          const success = await appendToSheet(sheetsConnectionId, cfg.spreadsheet_id, [row]);

          if (success) {
            totalPosted++;

            // Save as LIAM memory
            if (apiKeys) {
              const memoryContent = `Purchase: ${parsed.vendor} — ${parsed.amount} on ${parsed.date || "unknown date"}`;
              await saveMemoryToLiam(apiKeys.api_key, apiKeys.user_key, apiKeys.private_key, memoryContent, "EXPENSE");
            }
          }
        } catch (err) {
          console.error(`[ReceiptSheet] Error processing email ${email.messageId}:`, err);
          processed++;
        }
      }

      // Update counter
      if (totalPosted > 0) {
        const { data: currentCfg } = await sb
          .from("email_receipt_sheet_config")
          .select("rows_posted")
          .eq("user_id", userId)
          .single();
        await sb
          .from("email_receipt_sheet_config")
          .update({ rows_posted: ((currentCfg as any)?.rows_posted ?? 0) + totalPosted })
          .eq("user_id", userId);
      }

      return new Response(JSON.stringify({ processed, posted: totalPosted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ReceiptSheet] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
