import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BirthdayReminderPhase,
  BirthdayReminderConfig,
  BirthdayReminderStats,
  SentReminder,
} from "@/types/birthdayReminder";

export function useBirthdayReminder() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<BirthdayReminderPhase>("auth-check");
  const [config, setConfig] = useState<BirthdayReminderConfig | null>(null);
  const [sentReminders, setSentReminders] = useState<SentReminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: BirthdayReminderStats = {
    remindersSent: config?.remindersSent ?? 0,
    lastChecked: config?.lastCheckedAt ?? null,
    isActive: config?.isActive ?? false,
    daysBefore: config?.daysBefore ?? 7,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("birthday_reminder_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading birthday config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          remindersSent: d.reminders_sent ?? 0, lastCheckedAt: d.last_checked_at,
          daysBefore: d.days_before ?? 7, createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("birthday_reminder_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id, userId: d.user_id, isActive: false,
            remindersSent: 0, lastCheckedAt: null,
            daysBefore: d.days_before ?? 7, createdAt: d.created_at, updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }
      // Fetch sent reminders
      const { data: reminders } = await supabase
        .from("birthday_reminders_sent")
        .select("*")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false });

      if (reminders) {
        setSentReminders(
          reminders.map((r: any) => ({
            id: r.id,
            personName: r.person_name,
            birthdayDate: r.birthday_date,
            yearSent: r.year_sent,
            sentAt: r.sent_at,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("birthday-reminder", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Birthday reminders activated", description: "You'll get notified before birthdays" });
      return true;
    } catch {
      toast({ title: "Activation failed", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [toast]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke("birthday-reminder", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Birthday reminders paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const triggerManualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke("birthday-reminder", {
        body: { action: "manual-poll" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Check failed", description: error.message, variant: "destructive" });
        return false;
      }

      await loadConfig();
      const result = data as any;
      toast({ title: "Check complete", description: `Sent ${result?.remindersSent ?? 0} reminders` });
      return true;
    } catch {
      return false;
    } finally {
      setIsPolling(false);
    }
  }, [loadConfig, toast]);

  return {
    phase, setPhase, config, stats, sentReminders,
    isLoading, isActivating, isPolling,
    loadConfig, activateMonitoring, deactivateMonitoring, triggerManualPoll,
  };
}
