import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
      // Validate auth
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authentication required." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = user.id;

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

      // Generate a unique share token
      const shareToken = crypto.randomUUID();

      // Service role client for admin operations
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Insert share record using the user's client (respects RLS)
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

      // Resolve recipient emails to user IDs (best-effort, not blocking)
      if (normalizedEmails.length > 0) {
        const recipientRows: {
          share_id: string;
          recipient_email: string;
          recipient_user_id: string | null;
        }[] = [];

        for (const email of normalizedEmails) {
          let resolvedUserId: string | null = null;

          // Try to find a matching user account
          try {
            const { data: listData } = await adminClient.auth.admin.listUsers();
            if (listData?.users) {
              const match = listData.users.find(
                (u) => u.email?.toLowerCase() === email
              );
              if (match) resolvedUserId = match.id;
            }
          } catch {
            // Non-critical — continue without user resolution
          }

          recipientRows.push({
            share_id: shareId,
            recipient_email: email,
            recipient_user_id: resolvedUserId,
          });
        }

        // Insert all recipients in one batch using the user's client
        const { error: recipientsError } = await userClient
          .from("memory_share_recipients")
          .insert(recipientRows);

        if (recipientsError) {
          console.error("Failed to insert recipients:", recipientsError);
          // Non-critical failure — share is still valid
        }
      }

      // Build the canonical short share URL from env secret (change once, works everywhere)
      const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") ?? "https://weave-your-story-46.lovable.app").replace(/\/$/, "");
      const shareUrl = `${APP_BASE_URL}/s/${shareToken}`;

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

      // Use service role to bypass RLS for public token lookup
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

      // Fetch owner profile for display
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

      // Fetch recipients list (emails only, for display)
      const { data: recipientsData } = await adminClient
        .from("memory_share_recipients")
        .select("recipient_email")
        .eq("share_id", shareData.id);

      const recipients = recipientsData?.map((r) => r.recipient_email) || [];

      // Best-effort: mark viewed_at for the first unviewed recipient
      // (we can't reliably match by IP, so we skip — caller can provide their email)
      const callerEmail = body.viewer_email?.trim()?.toLowerCase();
      if (callerEmail) {
        await adminClient
          .from("memory_share_recipients")
          .update({ viewed_at: new Date().toISOString() })
          .eq("share_id", shareData.id)
          .eq("recipient_email", callerEmail)
          .is("viewed_at", null);
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

    // Fallthrough
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
