import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MyShare {
  id: string;
  memory_id: string;
  share_scope: "single" | "thread" | "custom";
  share_token: string;
  thread_tag: string | null;
  custom_condition: string | null;
  created_at: string;
  expires_at: string | null;
  visibility: "anyone" | "recipients_only";
  memory_content: { content?: string; tag?: string; created_at?: string } | null;
  recipients: { email: string; viewed_at: string | null }[];
}

export function useMyShares() {
  const [shares, setShares] = useState<MyShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchShares = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "list-my-shares" }),
        }
      );
      const data = await res.json();
      if (res.ok && data.shares) {
        setShares(data.shares);
      }
    } catch (e) {
      console.error("[useMyShares] error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revokeShare = useCallback(async (shareId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "revoke", share_id: shareId }),
        }
      );
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
        return true;
      }
      return false;
    } catch (e) {
      console.error("[useMyShares] revoke error:", e);
      return false;
    }
  }, []);

  return { shares, isLoading, fetchShares, revokeShare };
}
