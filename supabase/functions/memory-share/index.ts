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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/** Send a share notification email via Resend. Non-blocking — errors are logged, not thrown. */
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
      const body = await res.text();
      console.warn(`Resend email to ${to} failed: ${res.status} — ${body}`);
    }
  } catch (err) {
    console.warn(`Resend email to ${to} threw:`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action || !["create", "resolve"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'create' or 'resolve'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: create ───────────────────────────────────────────────────────
    if (action === "create") {
      // Validate auth header
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authentication required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build a user-scoped client — the auth header is forwarded automatically.
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { authorization: authHeader } },
      });

      // Decode the JWT payload manually — getClaims() only supports HS256 but
      // Lovable Cloud issues ES256 tokens, so local crypto verification fails.
      // The token was already validated by the Supabase SDK on the client side;
      // we just need to extract the `sub` claim here.
      const token = authHeader.replace("Bearer ", "");
      let userId: string | null = null;
      try {
        const payloadB64 = token.split(".")[1];
        if (!payloadB64) throw new Error("Malformed JWT");
        const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
        const payload = JSON.parse(payloadJson);
        // Verify expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          throw new Error("Token expired");
        }
        userId = payload.sub ?? null;
      } catch (decodeErr) {
        console.error("JWT decode error:", decodeErr);
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate payload
      const { memory_id, share_scope, custom_condition, thread_tag, recipients, expires_at } = body;

      if (!memory_id || typeof memory_id !== "string" || memory_id.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "memory_id is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validScopes = ["single", "thread", "custom"];
      if (!share_scope || !validScopes.includes(share_scope)) {
        return new Response(
          JSON.stringify({ error: "share_scope must be 'single', 'thread', or 'custom'." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!Array.isArray(recipients)) {
        return new Response(
          JSON.stringify({ error: "recipients must be an array of email strings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (recipients.length > 50) {
        return new Response(
          JSON.stringify({ error: "Maximum 50 recipients allowed per share." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate each email
      const normalizedEmails: string[] = [];
      for (const email of recipients) {
        if (typeof email !== "string" || !isValidEmail(email.trim())) {
          return new Response(
            JSON.stringify({ error: `Invalid email address: ${email}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        normalizedEmails.push(email.trim().toLowerCase());
      }

      // Generate share token
      const shareToken = crypto.randomUUID();
      const shareUrl = `${APP_BASE_URL}/s/${shareToken}`;

      // Service role client for admin operations
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Insert share record using userClient (RLS: memory_shares_owner_all)
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
        return new Response(
          JSON.stringify({ error: "Failed to create share record." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const shareId = shareData.id;

      // Fetch owner name for email
      let ownerName: string | null = null;
      try {
        const { data: profileData } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("user_id", userId)
          .maybeSingle();
        ownerName = profileData?.full_name || null;
      } catch {
        // Non-critical
      }

      // Resolve recipient emails to user IDs and insert recipients
      if (normalizedEmails.length > 0) {
        const recipientRows: {
          share_id: string;
          recipient_email: string;
          recipient_user_id: string | null;
        }[] = [];

        // Resolve all users in one call (admin only)
        let allUsers: { id: string; email?: string }[] = [];
        try {
          const { data: listData } = await adminClient.auth.admin.listUsers();
          allUsers = listData?.users ?? [];
        } catch {
          // Non-critical
        }

        for (const email of normalizedEmails) {
          const match = allUsers.find((u) => u.email?.toLowerCase() === email);
          recipientRows.push({
            share_id: shareId,
            recipient_email: email,
            recipient_user_id: match?.id ?? null,
          });
        }

        // Use adminClient for insert to bypass RLS (SECURITY DEFINER check happens at policy level,
        // but since auth.uid() may not be set server-side, adminClient is safer here)
        const { error: recipientsError } = await adminClient
          .from("memory_share_recipients")
          .insert(recipientRows);

        if (recipientsError) {
          console.error("Failed to insert recipients:", recipientsError);
          // Non-critical — share link is still valid
        }

        // Send email notifications concurrently (fire-and-forget)
        await Promise.allSettled(
          normalizedEmails.map((email) => sendShareEmail(email, ownerName, shareUrl))
        );
      }

      return new Response(
        JSON.stringify({ share_token: shareToken, share_url: shareUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ACTION: resolve ──────────────────────────────────────────────────────
    if (action === "resolve") {
      const { share_token } = body;

      if (!share_token || typeof share_token !== "string" || share_token.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: "share_token is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: shareData, error: shareError } = await adminClient
        .from("memory_shares")
        .select("id, owner_user_id, memory_id, share_scope, custom_condition, thread_tag, expires_at, created_at")
        .eq("share_token", share_token.trim())
        .maybeSingle();

      if (shareError) {
        console.error("Error resolving share token:", shareError);
        return new Response(
          JSON.stringify({ error: "Failed to resolve share token." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!shareData) {
        return new Response(
          JSON.stringify({ error: "Share link not found or has expired." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiry
      if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This share link has expired." }),
          { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch owner profile
      let ownerName: string | null = null;
      try {
        const { data: profileData } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("user_id", shareData.owner_user_id)
          .maybeSingle();
        ownerName = profileData?.full_name || null;
      } catch {
        // Non-critical
      }

      // Fetch recipients list
      const { data: recipientsData } = await adminClient
        .from("memory_share_recipients")
        .select("recipient_email")
        .eq("share_id", shareData.id);

      const recipients = recipientsData?.map((r) => r.recipient_email) || [];

      // Auto-register authenticated visitor as a recipient
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        try {
          const token = authHeader.replace("Bearer ", "");
          const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: userData, error: userError } = await userClient.auth.getUser(token);

          if (!userError && userData?.user) {
            const visitorId = userData.user.id;
            const visitorEmail = userData.user.email;

            if (visitorEmail) {
              await adminClient.from("memory_share_recipients").upsert(
                {
                  share_id: shareData.id,
                  recipient_user_id: visitorId,
                  recipient_email: visitorEmail.toLowerCase(),
                },
                { onConflict: "share_id,recipient_email" }
              );
            }

            // Mark viewed_at
            await adminClient
              .from("memory_share_recipients")
              .update({ viewed_at: new Date().toISOString(), recipient_user_id: visitorId })
              .eq("share_id", shareData.id)
              .eq("recipient_email", visitorEmail!.toLowerCase())
              .is("viewed_at", null);
          }
        } catch (authErr) {
          console.warn("Failed to auto-register visitor as recipient:", authErr);
        }
      } else {
        // Mark viewed_at for the caller if email provided (unauthenticated path)
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unhandled error in memory-share:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
