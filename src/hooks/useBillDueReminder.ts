import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BillDueReminderPhase,
  BillDueReminderConfig,
  BillDueReminderStats,
  ProcessedBill,
} from "@/types/billDueReminder";

export function useBillDueReminder() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<BillDueReminderPhase>("auth-check");
  const [config, setConfig] = useState<BillDueReminderConfig | null>(null);
  const [bills, setBills] = useState<ProcessedBill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: BillDueReminderStats = {
    billsFound: config?.billsFound ?? 0,
    isActive: config?.isActive ?? false,
  };

  const loadBills = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("bill_due_reminder_processed" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setBills(
        (data as any[]).map((d) => ({
          id: d.id,
          emailMessageId: d.email_message_id,
          billerName: d.biller_name ?? null,
          amountDue: d.amount_due ?? null,
          dueDate: d.due_date ?? null,
          subject: d.subject ?? null,
          createdAt: d.created_at,
        }))
      );
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("bill_due_reminder_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading bill due reminder config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          billsFound: d.bills_found ?? 0,
          phoneNumber: d.phone_number ?? null,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
        await loadBills(user.id);
      } else {
        const { data: newConfig } = await supabase
          .from("bill_due_reminder_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            billsFound: 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadBills]);

  const activate = useCallback(async (phoneNumber: string): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("bill-due-reminder", {
        body: { action: "activate", phoneNumber },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Bill scanner activated", description: "Gmail will be scanned for bill notifications" });
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

      const { error } = await supabase.functions.invoke("bill-due-reminder", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Bill scanner paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const deleteBill = useCallback(async (billId: string) => {
    try {
      const { error } = await supabase
        .from("bill_due_reminder_processed" as any)
        .delete()
        .eq("id", billId);

      if (error) {
        toast({ title: "Failed to remove bill", variant: "destructive" });
        return;
      }

      setBills((prev) => prev.filter((b) => b.id !== billId));
      setConfig((prev) => prev ? { ...prev, billsFound: Math.max(0, prev.billsFound - 1) } : null);

      if (config) {
        await supabase
          .from("bill_due_reminder_config" as any)
          .update({ bills_found: Math.max(0, (config.billsFound ?? 1) - 1) })
          .eq("id", config.id);
      }

      toast({ title: "Bill removed" });
    } catch {
      toast({ title: "Failed to remove bill", variant: "destructive" });
    }
  }, [toast, config]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("bill-due-reminder", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      const result = data as { processed?: number; bills?: number };
      toast({
        title: "Sync complete",
        description: `Processed ${result.processed ?? 0} emails — ${result.bills ?? 0} new bills found`,
      });

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, config, stats, bills,
    isLoading, isActivating, isSyncing,
    loadConfig, activate, deactivate, deleteBill, manualSync,
  };
}
