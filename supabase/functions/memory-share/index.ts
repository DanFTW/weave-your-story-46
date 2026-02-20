import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") ?? "https://weave-your-story-46.lovable.app").replace(/\/$/, "");
const LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Send a share notification email via Resend. Non-blocking. */
async function sendShareEmail(to: string, ownerName: string | null, shareUrl: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const senderName = ownerName ?? "Someone";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Weave <onboarding@resend.dev>",
        to: [to],
        subject: `${senderName} shared a memory with you`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <h2 style="font-size:20px;margin-bottom:8px;">A memory was shared with you</h2>
            <p style="color:#555;font-size:15px;line-height:1.6;">
              <strong>${senderName}</strong> shared a memory with you on <strong>Weave</strong>.
              Click the button below to view it.
            </p>
            <a href="${shareUrl}"
               style="display:inline-block;margin-top:20px;padding:12px 24px;background:#000;color:#fff;
                      text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">
              View memory →
            </a>
            <p style="margin-top:24px;font-size:12px;color:#999;">
              If you weren't expecting this, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      const b = await res.text();
      console.warn(`Resend email to ${to} failed: ${res.status} — ${b}`);
    }
  } catch (err) {
    console.warn(`Resend email to ${to} threw:`, err);
  }
}

// ─── LIAM helpers (reused from liam-memory function) ─────────────────────────

function removeLeadingZeros(arr: number[]): number[] {
  while (arr.length > 1 && arr[0] === 0 && !(arr[1] & 0x80)) arr = arr.slice(1);
  return arr;
}

function constructLength(arr: number[], len: number): void {
  if (len < 0x80) {
    arr.push(len);
    return;
  }
  const octets = 1 + ((Math.log(len) / Math.LN2) >>> 3);
  arr.push(octets | 0x80);
  for (let i = octets - 1; i >= 0; i--) arr.push((len >>> (i * 8)) & 0xff);
}

function toDER(signature: Uint8Array): string {
  let r = Array.from(signature.slice(0, 32));
  let s = Array.from(signature.slice(32));
  if (r[0] & 0x80) r = [0].concat(r);
  if (s[0] & 0x80) s = [0].concat(s);
  r = removeLeadingZeros(r);
  s = removeLeadingZeros(s);
  let arr: number[] = [0x02];
  constructLength(arr, r.length);
  arr = arr.concat(r);
  arr.push(0x02);
  constructLength(arr, s.length);
  arr = arr.concat(s);
  let result: number[] = [0x30];
  constructLength(result, arr.length);
  result = result.concat(arr);
  return btoa(String.fromCharCode(...result));
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(pemContents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey("pkcs8", bytes.buffer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function liamRequest(endpoint: string, body: object, apiKey: string, privateKey: CryptoKey): Promise<any> {
  const bodyStr = JSON.stringify(body);
  const raw = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(bodyStr),
  );
  const signature = toDER(new Uint8Array(raw));
  const res = await fetch(`${LIAM_API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apiKey, signature },
    body: bodyStr,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LIAM ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const validActions = ["create", "resolve", "fetch-shared-memory", "list-received"];
    if (!action || !validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── ACTION: create ─────────────────────────────────────────────────────
    if (action === "create") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authentication required." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      let userId: string | null = null;
      try {
        const payloadB64 = token.split(".")[1];
        if (!payloadB64) throw new Error("Malformed JWT");
        const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
        userId = payload.sub ?? null;
      } catch (e) {
        console.error("JWT decode error:", e);
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid or expired session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { memory_id, share_scope, custom_condition, thread_tag, recipients, expires_at } = body;

      if (!memory_id?.trim()) {
        return new Response(JSON.stringify({ error: "memory_id is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["single", "thread", "custom"].includes(share_scope)) {
        return new Response(JSON.stringify({ error: "share_scope must be 'single', 'thread', or 'custom'." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!Array.isArray(recipients)) {
        return new Response(JSON.stringify({ error: "recipients must be an array of email strings." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (recipients.length > 50) {
        return new Response(JSON.stringify({ error: "Maximum 50 recipients allowed per share." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedEmails: string[] = [];
      for (const email of recipients) {
        if (typeof email !== "string" || !isValidEmail(email.trim())) {
          return new Response(JSON.stringify({ error: `Invalid email address: ${email}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        normalizedEmails.push(email.trim().toLowerCase());
      }

      const shareToken = crypto.randomUUID();
      const shareUrl = `${APP_BASE_URL}/s/${shareToken}`;

      const { data: shareData, error: shareError } = await userClient
        .from("memory_shares")
        .insert({
          owner_user_id: userId,
          memory_id: memory_id.trim(),
          share_scope,
          share_token: shareToken,
          custom_condition: custom_condition?.trim() || null,
          thread_tag: thread_tag?.trim() || null,
          expires_at: expires_at || null,
        })
        .select("id")
        .single();

      if (shareError || !shareData) {
        console.error("Failed to insert memory_share:", shareError);
        return new Response(JSON.stringify({ error: "Failed to create share record." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const shareId = shareData.id;

      let ownerName: string | null = null;
      try {
        const { data: p } = await adminClient.from("profiles").select("full_name").eq("user_id", userId).maybeSingle();
        ownerName = p?.full_name || null;
      } catch {
        /* non-critical */
      }

      if (normalizedEmails.length > 0) {
        const recipientRows: { share_id: string; recipient_email: string; recipient_user_id: string | null }[] = [];
        let allUsers: { id: string; email?: string }[] = [];
        try {
          const { data: listData } = await adminClient.auth.admin.listUsers();
          allUsers = listData?.users ?? [];
        } catch {
          /* non-critical */
        }

        for (const email of normalizedEmails) {
          const match = allUsers.find((u) => u.email?.toLowerCase() === email);
          recipientRows.push({ share_id: shareId, recipient_email: email, recipient_user_id: match?.id ?? null });
        }

        const { error: recipientsError } = await adminClient.from("memory_share_recipients").insert(recipientRows);
        if (recipientsError) console.error("Failed to insert recipients:", recipientsError);

        await Promise.allSettled(normalizedEmails.map((email) => sendShareEmail(email, ownerName, shareUrl)));
      }

      return new Response(JSON.stringify({ share_token: shareToken, share_url: shareUrl }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: resolve ────────────────────────────────────────────────────
    if (action === "resolve") {
      const { share_token } = body;
      if (!share_token?.trim()) {
        return new Response(JSON.stringify({ error: "share_token is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: shareData, error: shareError } = await adminClient
        .from("memory_shares")
        .select("id, owner_user_id, memory_id, share_scope, custom_condition, thread_tag, expires_at, created_at")
        .eq("share_token", share_token.trim())
        .maybeSingle();

      if (shareError) {
        console.error("Error resolving share token:", shareError);
        return new Response(JSON.stringify({ error: "Failed to resolve share token." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!shareData) {
        return new Response(JSON.stringify({ error: "Share link not found or has expired." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This share link has expired." }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let ownerName: string | null = null;
      try {
        const { data: p } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("user_id", shareData.owner_user_id)
          .maybeSingle();
        ownerName = p?.full_name || null;
      } catch {
        /* non-critical */
      }

      const { data: recipientsData } = await adminClient
        .from("memory_share_recipients")
        .select("recipient_email")
        .eq("share_id", shareData.id);

      const recipients = recipientsData?.map((r) => r.recipient_email) || [];

      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { authorization: authHeader } },
        });
        const {
          data: { user: authedUser },
        } = await userClient.auth.getUser();
        if (authedUser?.id && authedUser?.email) {
          await adminClient
            .from("memory_share_recipients")
            .upsert(
              {
                share_id: shareData.id,
                recipient_user_id: authedUser.id,
                recipient_email: authedUser.email.toLowerCase(),
              },
              { onConflict: "share_id,recipient_email" },
            );
        }
      } else {
        const callerEmail = body.viewer_email?.trim()?.toLowerCase();
        if (callerEmail) {
          await adminClient
            .from("memory_share_recipients")
            .update({ viewed_at: new Date().toISOString() })
            .eq("share_id", shareData.id)
            .eq("recipient_email", callerEmail)
            .is("viewed_at", null);
        }
      }

      return new Response(
        JSON.stringify({
          memory_id: shareData.memory_id,
          share_scope: shareData.share_scope,
          custom_condition: shareData.custom_condition,
          thread_tag: shareData.thread_tag,
          owner_user_id: shareData.owner_user_id,
          owner_name: ownerName,
          recipients,
          created_at: shareData.created_at,
          expires_at: shareData.expires_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: fetch-shared-memory ────────────────────────────────────────
    // Fetches the actual memory content from LIAM using the owner's API keys.
    // Only accessible to authenticated users listed as recipients.
    if (action === "fetch-shared-memory") {
      const { shareToken } = body;
      if (!shareToken) {
        return new Response(JSON.stringify({ error: "shareToken is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Require auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authentication required." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify caller identity
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { authorization: authHeader } },
      });
      const {
        data: { user: callerUser },
      } = await userClient.auth.getUser();
      if (!callerUser) {
        return new Response(JSON.stringify({ error: "Invalid or expired session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve the share
      const { data: share, error: shareErr } = await adminClient
        .from("memory_shares")
        .select("id, memory_id, owner_user_id, expires_at")
        .eq("share_token", shareToken)
        .maybeSingle();

      if (shareErr || !share) {
        return new Response(JSON.stringify({ error: "Share not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This share link has expired." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify caller is a listed recipient (by user_id or email)
      const { data: recipient } = await adminClient
        .from("memory_share_recipients")
        .select("id")
        .eq("share_id", share.id)
        .or(`recipient_user_id.eq.${callerUser.id},recipient_email.eq.${callerUser.email?.toLowerCase()}`)
        .maybeSingle();

      if (!recipient) {
        return new Response(JSON.stringify({ error: "You don't have access to this memory." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the owner's LIAM credentials
      const { data: creds, error: credsErr } = await adminClient
        .from("user_api_keys")
        .select("api_key, private_key, user_key")
        .eq("user_id", share.owner_user_id)
        .single();

      if (credsErr || !creds?.api_key || !creds?.private_key || !creds?.user_key) {
        console.error("Owner LIAM credentials unavailable:", credsErr);
        return new Response(JSON.stringify({ error: "Memory owner credentials unavailable." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Import the owner's private key and fetch all their memories from LIAM
      let privateKey: CryptoKey;
      try {
        privateKey = await importPrivateKey(creds.private_key);
      } catch (e) {
        console.error("Failed to import owner private key:", e);
        return new Response(JSON.stringify({ error: "Failed to process owner credentials." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let liamData: any;
      try {
        liamData = await liamRequest("/memory/list", { userKey: creds.user_key }, creds.api_key, privateKey);
      } catch (e: any) {
        console.error("LIAM list error:", e);
        return new Response(JSON.stringify({ error: "Failed to fetch memory from LIAM." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the specific memory by its transaction number / ID
      const allMemories: any[] = liamData?.data?.memories || liamData?.memories || [];
      const found = allMemories.find(
        (m: any) => m.transactionNumber === share.memory_id || m.queryHash === share.memory_id,
      );

      if (!found) {
        // Memory may have been deleted — return a graceful response
        return new Response(JSON.stringify({ error: "Memory no longer available." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch owner name for display
      let ownerName: string | null = null;
      try {
        const { data: p } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("user_id", share.owner_user_id)
          .maybeSingle();
        ownerName = p?.full_name || null;
      } catch {
        /* non-critical */
      }

      // Mark as viewed
      await adminClient
        .from("memory_share_recipients")
        .update({ viewed_at: new Date().toISOString() })
        .eq("share_id", share.id)
        .eq("recipient_user_id", callerUser.id)
        .is("viewed_at", null);

      return new Response(
        JSON.stringify({
          memory: {
            id: found.transactionNumber || found.queryHash,
            content: found.memory || found.content || "",
            tag: found.notesKey || found.tag || null,
            tags: found.notesKey ? [found.notesKey] : [],
            created_at: found.date || null,
            owner_name: ownerName,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── ACTION: list-received ──────────────────────────────────────────────
    if (action === "list-received") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Authentication required." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { authorization: authHeader } },
      });
      const {
        data: { user },
      } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rows } = await adminClient
        .from("memory_share_recipients")
        .select(
          "share_id, recipient_email, viewed_at, memory_shares(share_token, memory_id, share_scope, thread_tag, created_at, expires_at, owner_user_id)",
        )
        .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email?.toLowerCase()}`);

      return new Response(JSON.stringify({ shares: rows ?? [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in memory-share:", err);
    return new Response(JSON.stringify({ error: "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
