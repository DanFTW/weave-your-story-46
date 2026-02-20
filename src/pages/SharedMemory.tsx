import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Share2, ArrowRight, Clock, Tag, Sparkles, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
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

interface MemoryContent {
  id: string;
  title?: string;
  content: string;
  tag?: string;
  tags?: string[];
  created_at?: string;
}

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "landing"; data: ShareMetadata } // unauthenticated
  | { status: "ready"; meta: ShareMetadata; memory: MemoryContent }; // authenticated + content loaded

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function resolveShareToken(token: string, accessToken?: string): Promise<ShareMetadata> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/memory-share`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "resolve", share_token: token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load shared memory.");
  return data as ShareMetadata;
}

async function fetchSharedContent(token: string, accessToken: string): Promise<MemoryContent> {
  const res = await supabase.functions.invoke("memory-share", {
    body: { action: "fetch-shared-memory", shareToken: token },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data.memory as MemoryContent;
}

function scopeDescription(data: ShareMetadata): { icon: React.ReactNode; label: string } {
  if (data.share_scope === "single") {
    return { icon: <Share2 className="h-4 w-4" />, label: "A single memory" };
  }
  if (data.share_scope === "thread") {
    return {
      icon: <Tag className="h-4 w-4" />,
      label: data.thread_tag ? `All memories tagged "${data.thread_tag}"` : "All memories from a thread",
    };
  }
  return {
    icon: <Sparkles className="h-4 w-4" />,
    label: data.custom_condition ? `Memories matching: "${data.custom_condition}"` : "Custom condition",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SharedMemory() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Invalid share link." });
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Authenticated: resolve metadata + fetch actual memory content
        try {
          const [meta, memory] = await Promise.all([
            resolveShareToken(token, session.access_token),
            fetchSharedContent(token, session.access_token),
          ]);
          setState({ status: "ready", meta, memory });
        } catch (err: any) {
          setState({ status: "error", message: err.message ?? "Failed to load shared memory." });
        }
      } else {
        // Unauthenticated: show landing card so they can sign in
        localStorage.setItem("pendingShareToken", token);
        resolveShareToken(token)
          .then((data) => setState({ status: "landing", data }))
          .catch((err: Error) => setState({ status: "error", message: err.message }));
      }
    });
  }, [token]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (state.status === "loading") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-5">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading shared memory…</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (state.status === "error") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-background px-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Link not found</h1>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">{state.message}</p>
        <Link to="/login">
          <Button variant="outline">Sign in to your account</Button>
        </Link>
      </div>
    );
  }

  // ── Unauthenticated landing card ─────────────────────────────────────────

  if (state.status === "landing") {
    const { data } = state;
    const scope = scopeDescription(data);
    const sharedAt = (() => {
      try {
        return format(parseISO(data.created_at), "MMMM d, yyyy 'at' h:mm a");
      } catch {
        return null;
      }
    })();

    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b border-border/40 px-5 py-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Share2 className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Shared Memory</span>
        </header>

        <main className="flex-1 px-5 py-8 max-w-lg mx-auto w-full space-y-6">
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-foreground">
              {data.owner_name ? `${data.owner_name} shared a memory with you` : "Someone shared a memory with you"}
            </p>
            {sharedAt && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                {sharedAt}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border/30">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                  data.share_scope === "single"
                    ? "bg-primary/10 text-primary"
                    : data.share_scope === "thread"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                )}
              >
                {scope.icon}
                {scope.label}
              </div>
            </div>
            <div className="px-4 py-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-xl bg-muted mx-auto flex items-center justify-center">
                <Share2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Sign in to view this memory</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Memory content is stored securely. Sign in to view the full memory.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full h-12 text-sm font-semibold" onClick={() => navigate("/login")}>
              Sign in to view
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          {data.expires_at && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                This link expires on {format(parseISO(data.expires_at), "MMMM d, yyyy")}.
              </p>
            </div>
          )}
        </main>

        <footer className="px-5 py-4 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            Shared via <span className="font-semibold text-foreground">Weave</span> — your personal memory layer
          </p>
        </footer>
      </div>
    );
  }

  // ── Authenticated: full memory content ───────────────────────────────────

  const { meta, memory } = state;
  const scope = scopeDescription(meta);
  const tags = memory.tags?.length ? memory.tags : memory.tag ? [memory.tag] : [];
  const createdAt = (() => {
    try {
      const d = memory.created_at || meta.created_at;
      return d ? format(parseISO(d), "MMMM d, yyyy") : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-dvh bg-[#E3EFF3]" style={{ fontFamily: "PP Telegraf, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button
          onClick={() => navigate("/memories?view=shared")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/60 shrink-0"
        >
          <ArrowLeft size={20} color="#292C39" />
        </button>
        <span style={{ color: "#3D4359", fontSize: 14, fontWeight: 500 }}>
          Shared by {meta.owner_name ?? "Someone"}
        </span>
      </div>

      {/* Scope badge */}
      <div className="px-5 pb-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
            meta.share_scope === "single"
              ? "bg-[#1050C5]/10 text-[#1050C5]"
              : meta.share_scope === "thread"
                ? "bg-blue-500/10 text-blue-600"
                : "bg-purple-500/10 text-purple-600",
          )}
        >
          {scope.icon}
          {scope.label}
        </div>
      </div>

      {/* Memory card */}
      <div className="px-5 pb-10">
        <div
          style={{
            background: "white",
            borderRadius: 28,
            padding: "24px 20px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Title */}
          {memory.title && (
            <h1 style={{ color: "#292C39", fontSize: 22, fontWeight: 700, lineHeight: 1.25, marginBottom: 16 }}>
              {memory.title}
            </h1>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#E3EFF3",
                    color: "#1050C5",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 100,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <p style={{ color: "#3D4359", fontSize: 16, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{memory.content}</p>

          {/* Date */}
          {createdAt && <p style={{ color: "#92B1D7", fontSize: 13, marginTop: 20 }}>{createdAt}</p>}
        </div>

        {/* CTA */}
        <div className="mt-6">
          <button
            onClick={() => navigate("/memories?view=shared")}
            style={{
              width: "100%",
              padding: "16px 20px",
              background: "radial-gradient(ellipse 108.65% 103.45% at 50% 109.62%, #FF543E 0%, #1050C5 60%)",
              color: "white",
              fontFamily: "PP Telegraf, sans-serif",
              fontWeight: 700,
              fontSize: 16,
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            View all shared memories
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
