import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  EmailReceiptSheetPhase,
  EmailReceiptSheetConfig,
  EmailReceiptSheetStats,
  SpreadsheetOption,
} from "@/types/emailReceiptSheet";

export function useEmailReceiptSheet() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<EmailReceiptSheetPhase>("auth-check");
  const [config, setConfig] = useState<EmailReceiptSheetConfig | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  const stats: EmailReceiptSheetStats = {
    rowsPosted: config?.rowsPosted ?? 0,
    isActive: config?.isActive ?? false,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("email_receipt_sheet_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading email receipt sheet config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          spreadsheetId: d.spreadsheet_id,
          spreadsheetName: d.spreadsheet_name,
          sheetName: d.sheet_name,
          rowsPosted: d.rows_posted ?? 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("email_receipt_sheet_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            spreadsheetId: null,
            spreadsheetName: null,
            sheetName: null,
            rowsPosted: 0,
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

  const listSpreadsheets = useCallback(async () => {
    setIsLoadingSheets(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "list-spreadsheets" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const errorBody = error?.context?.body ? await error.context.json?.().catch(() => null) : null;
        if (errorBody?.needsReconnect) {
          toast({ title: "Google Sheets connection expired", description: "Please reconnect your Google Sheets account.", variant: "destructive" });
          setPhase("needs-reconnect");
          return;
        }
        toast({ title: "Failed to load spreadsheets", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.needsReconnect) {
        toast({ title: "Google Sheets connection expired", description: "Please reconnect your Google Sheets account.", variant: "destructive" });
        setPhase("needs-reconnect");
        return;
      }

      setSpreadsheets(data?.spreadsheets ?? []);
    } catch {
      toast({ title: "Failed to load spreadsheets", variant: "destructive" });
    } finally {
      setIsLoadingSheets(false);
    }
  }, [toast]);

  const createSpreadsheet = useCallback(async (): Promise<SpreadsheetOption | null> => {
    setIsCreatingSheet(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "create-spreadsheet" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Failed to create spreadsheet", description: error.message, variant: "destructive" });
        return null;
      }

      if (data?.needsReconnect) {
        toast({ title: "Google Sheets connection expired", description: "Please reconnect your Google Sheets account.", variant: "destructive" });
        setPhase("needs-reconnect");
        return null;
      }

      if (!data?.spreadsheetId) {
        toast({ title: "Spreadsheet created but ID missing", variant: "destructive" });
        return null;
      }
      const newSheet: SpreadsheetOption = { id: data.spreadsheetId, name: data.spreadsheetName ?? "Weave — Expense Tracker" };
      setSpreadsheets((prev) => [newSheet, ...prev]);
      toast({ title: "Spreadsheet created", description: newSheet.name });
      return newSheet;
    } catch {
      toast({ title: "Failed to create spreadsheet", variant: "destructive" });
      return null;
    } finally {
      setIsCreatingSheet(false);
    }
  }, [toast]);

  const updateConfig = useCallback(async (spreadsheetId: string, spreadsheetName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "update-config", spreadsheetId, spreadsheetName },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setConfig((prev) => prev ? { ...prev, spreadsheetId, spreadsheetName } : null);
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

      const { error } = await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Expense tracking activated", description: "Receipt emails will be parsed and posted to your sheet" });
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

      const { error } = await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Expense tracking paused" });
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

      const { data, error } = await supabase.functions.invoke("email-receipt-sheet", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.needsReconnect) {
        toast({ title: "Google Sheets connection expired", description: "Please reconnect your Google Sheets account.", variant: "destructive" });
        setPhase("needs-reconnect");
        return;
      }

      const result = data as { processed?: number; posted?: number };
      toast({
        title: "Sync complete",
        description: `Processed ${result.processed ?? 0} emails — ${result.posted ?? 0} expense rows posted`,
      });

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, config, stats, spreadsheets,
    isLoading, isActivating, isSyncing, isLoadingSheets, isCreatingSheet,
    loadConfig, listSpreadsheets, createSpreadsheet, updateConfig,
    activate, deactivate, manualSync,
  };
}
