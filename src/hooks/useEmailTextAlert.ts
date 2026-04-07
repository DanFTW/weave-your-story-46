import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EmailTextAlertPhase,
  EmailTextAlertConfig,
  EmailTextAlertStats,
} from "@/types/emailTextAlert";

export function useEmailTextAlert() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<EmailTextAlertPhase>("auth-check");
  const [config, setConfig] = useState<EmailTextAlertConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: EmailTextAlertStats = {
    alertsSent: config?.alertsSent ?? 0,
    isActive: config?.isActive ?? false,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("email_text_alert_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading email text alert config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          senderFilter: d.sender_filter,
          keywordFilter: d.keyword_filter,
          phoneNumber: d.phone_number,
          alertsSent: d.alerts_sent ?? 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("email_text_alert_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            senderFilter: null,
            keywordFilter: null,
            phoneNumber: null,
            alertsSent: 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (senderFilter: string, keywordFilter: string, phoneNumber: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("email-text-alert", {
        body: { action: "update-config", senderFilter, keywordFilter, phoneNumber },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setConfig((prev) => prev ? { ...prev, senderFilter, keywordFilter, phoneNumber } : null);
    } catch {
      toast({ title: "Failed to update config", variant: "destructive" });
    }
  }, [toast]);

  const activate = useCallback(async (): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("email-text-alert", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Email alerts activated", description: "Matching emails will generate text alert summaries" });
      return true;
    } catch {
      toast({ title: "Activation failed", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [toast]);

  const deactivate = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke("email-text-alert", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Email alerts paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("email-text-alert", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      const result = data as { processed?: number; alerts?: number };
      toast({
        title: "Sync complete",
        description: `Processed ${result.processed ?? 0} emails — ${result.alerts ?? 0} new alerts`,
      });

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, config, stats,
    isLoading, isActivating, isSyncing,
    loadConfig, updateConfig, activate, deactivate, manualSync,
  };
}
