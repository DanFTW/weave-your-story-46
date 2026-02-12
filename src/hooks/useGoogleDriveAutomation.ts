import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  GoogleDriveAutomationPhase,
  GoogleDriveAutomationConfig,
  GoogleDriveAutomationStats,
} from "@/types/googledriveAutomation";

export function useGoogleDriveAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<GoogleDriveAutomationPhase>('auth-check');
  const [config, setConfig] = useState<GoogleDriveAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: GoogleDriveAutomationStats = {
    documentsSaved: config?.documentsSaved ?? 0,
    isActive: config?.isActive ?? false,
    lastSyncAt: config?.lastSyncAt ?? null,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('googledrive_automation_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading googledrive config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          triggerInstanceId: d.trigger_instance_id,
          documentsSaved: d.documents_saved ?? 0,
          lastSyncAt: d.last_sync_at ?? null,
          lastWebhookAt: d.last_webhook_at ?? null,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('googledrive_automation_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          triggerInstanceId: n.trigger_instance_id,
          documentsSaved: n.documents_saved ?? 0,
          lastSyncAt: n.last_sync_at ?? null,
          lastWebhookAt: n.last_webhook_at ?? null,
          createdAt: n.created_at, updatedAt: n.updated_at,
        });
        setPhase('configure');
      }
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'activate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        isActive: true,
        triggerInstanceId: data.triggerInstanceId ?? prev.triggerInstanceId,
        documentsSaved: data.totalSaved ?? prev.documentsSaved,
        lastSyncAt: new Date().toISOString(),
      } : null);
      setPhase('active');

      const msg = data.newDocuments > 0
        ? `Monitoring activated — ${data.newDocuments} document(s) saved`
        : "Monitoring activated — new Google Docs will be saved automatically";
      toast({ title: msg });
      return true;
    } catch (err) {
      console.error('Error activating:', err);
      toast({ title: "Activation failed", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, toast]);

  const manualSync = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'manual-poll' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        documentsSaved: data.totalSaved ?? prev.documentsSaved,
        lastSyncAt: new Date().toISOString(),
      } : null);

      if (data.newDocuments > 0) {
        toast({ title: `${data.newDocuments} new document(s) saved` });
      } else {
        toast({ title: "No new documents found" });
      }
      return true;
    } catch (err) {
      console.error('Error syncing:', err);
      toast({ title: "Sync failed", variant: "destructive" });
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke('googledrive-automation-triggers', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "New documents will not be saved" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, toast]);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setConfig(null);
  }, []);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isSyncing,
    loadConfig, activateMonitoring, deactivateMonitoring, manualSync, reset,
  };
}
