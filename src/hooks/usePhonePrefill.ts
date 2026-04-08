import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{7,}\d)/;

/**
 * Resolves the user's phone number from available sources:
 * 1. Current thread's config (passed in)
 * 2. Cross-thread config tables
 * 3. LIAM memories (phone/contact patterns)
 */
export function usePhonePrefill(currentPhone: string | null | undefined): {
  phone: string;
  isLoading: boolean;
} {
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [isLoading, setIsLoading] = useState(!currentPhone);

  useEffect(() => {
    if (currentPhone) {
      setPhone(currentPhone);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function resolve() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // 1. Check cross-thread config tables
        const [alertRes, eventRes] = await Promise.all([
          supabase
            .from("email_text_alert_config")
            .select("phone_number")
            .eq("user_id", user.id)
            .not("phone_number", "is", null)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("weekly_event_finder_config")
            .select("phone_number")
            .eq("user_id", user.id)
            .not("phone_number", "is", null)
            .limit(1)
            .maybeSingle(),
        ]);

        const crossPhone =
          alertRes.data?.phone_number || eventRes.data?.phone_number;

        if (crossPhone && !cancelled) {
          setPhone(crossPhone);
          setIsLoading(false);
          return;
        }

        // 2. Check LIAM memories for phone patterns
        try {
          const { data: liamRes } = await supabase.functions.invoke("liam-memory", {
            body: { action: "list" },
          });

          if (cancelled) return;

          const memories: any[] =
            liamRes?.data?.memories ?? liamRes?.memories ?? [];

          for (const mem of memories) {
            const tags: string[] = Array.isArray(mem.tags) ? mem.tags : [];
            const content: string = typeof mem.content === "string" ? mem.content : "";
            const isPhoneTag = tags.some(
              (t) =>
                t.toUpperCase().includes("PHONE") ||
                t.toUpperCase().includes("CONTACT") ||
                t.toUpperCase().includes("SMS")
            );

            if (isPhoneTag || content.toLowerCase().includes("phone")) {
              const match = content.match(PHONE_REGEX);
              if (match) {
                setPhone(match[0].trim());
                return;
              }
            }
          }
        } catch {
          // LIAM unavailable — not critical
        }
      } catch {
        // auth or query error — leave empty
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [currentPhone]);

  return { phone, isLoading };
}
