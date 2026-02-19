import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Share2, ArrowRight, Clock, Tag, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareMetadata {
  memory_id: string;
  share_scope: "single" | "thread" | "custom";
  custom_condition: string | null;
  thread_tag: string | null;
  owner_user_id: string;
  owner_name: string | null;
  recipients: string[];
  created_at: string;
  expires_at: string | null;
}

type ResolveState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: ShareMetadata };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function resolveShareToken(token: string, accessToken?: string): Promise<ShareMetadata> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/memory-share`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "resolve", share_token: token }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to load shared memory.");
  }

  return data as ShareMetadata;
}

function scopeDescription(data: ShareMetadata): { icon: React.ReactNode; label: string } {
  if (data.share_scope === "single") {
    return {
      icon: <Share2 className="h-4 w-4" />,
      label: "A single memory",
    };
  }
  if (data.share_scope === "thread") {
    return {
      icon: <Tag className="h-4 w-4" />,
      label: data.thread_tag
        ? `All memories tagged "${data.thread_tag}"`
        : "All memories from a thread",
    };
  }
  return {
    icon: <Sparkles className="h-4 w-4" />,
    label: data.custom_condition
      ? `Memories matching: "${data.custom_condition}"`
      : "Custom condition",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SharedMemory() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ResolveState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Invalid share link." });
      return;
    }

    // Check if user is already authenticated
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Authenticated: resolve with auth token so edge fn registers this viewer,
        // then redirect straight to the Shared With Me tab
        try {
          await resolveShareToken(token, session.access_token);
        } catch {
          // Even if resolve fails, still redirect — they may already be a recipient
        }
        navigate("/memories?view=shared", { replace: true });
      } else {
        // Unauthenticated: persist token for post-login/signup consumption
        localStorage.setItem("pendingShareToken", token);
        // Then load the landing card so they can choose to sign in / sign up
        resolveShareToken(token)
          .then((data) => setState({ status: "success", data }))
          .catch((err: Error) =>
            setState({ status: "error", message: err.message })
          );
      }
    });
  }, [token, navigate]);

  // ── Loading ─────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-5">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading shared memory…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────

  if (state.status === "error") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Link not found</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          {state.message}
        </p>
        <Link to="/login">
          <Button variant="outline">Sign in to your account</Button>
        </Link>
      </div>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────

  const { data } = state;
  const scope = scopeDescription(data);
  const sharedAt = (() => {
    try {
      return format(parseISO(data.created_at), "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return null;
    }
  })();

  const deepLink = "/memories?view=shared";

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <header className="border-b border-border/40 px-5 py-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Share2 className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Shared Memory</span>
      </header>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 px-5 py-8 max-w-lg mx-auto w-full space-y-6">
        {/* Sharer info */}
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-foreground">
            {data.owner_name
              ? `${data.owner_name} shared a memory with you`
              : "Someone shared a memory with you"}
          </p>
          {sharedAt && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {sharedAt}
            </p>
          )}
        </div>

        {/* Share details card */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {/* Scope badge */}
          <div className="px-4 py-3 bg-muted/40 border-b border-border/30">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                data.share_scope === "single"
                  ? "bg-primary/10 text-primary"
                  : data.share_scope === "thread"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
              )}
            >
              {scope.icon}
              {scope.label}
            </div>
          </div>

          {/* Memory preview placeholder */}
          <div className="px-4 py-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-xl bg-muted mx-auto flex items-center justify-center">
              <Share2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Memory content is private
              </p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Memory content is stored securely. Sign in to view the full memory in the app.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link to={`/login?redirect=${encodeURIComponent(deepLink)}`} className="block">
            <Button className="w-full h-12 text-sm font-semibold">
              View in app
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            You'll need to sign in to see the full memory.
          </p>
        </div>

        {/* Expiry notice */}
        {data.expires_at && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              This link expires on{" "}
              {format(parseISO(data.expires_at), "MMMM d, yyyy")}.
            </p>
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="px-5 py-4 border-t border-border/30 text-center">
        <p className="text-xs text-muted-foreground">
          Shared via{" "}
          <span className="font-semibold text-foreground">Weave</span>
          {" "}— your personal memory layer
        </p>
      </footer>
    </div>
  );
}
