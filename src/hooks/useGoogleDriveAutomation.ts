import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  GoogleDriveAutomationPhase,
  GoogleDriveAutomationConfig,
  GoogleDriveDocStats,
} from "@/types/googleDriveAutomation";

export function useGoogleDriveAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<GoogleDriveAutomationPhase>('auth-check');
  const [config, setConfig] = useState<GoogleDriveAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: GoogleDriveDocStats = {
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
          triggerInstanceId: d.trigger_instance_id ?? null,
          documentsSaved: d.documents_saved ?? 0,
          lastSyncAt: d.last_sync_at ?? null,
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
          triggerInstanceId: n.trigger_instance_id ?? null,
          documentsSaved: n.documents_saved ?? 0,
          lastSyncAt: n.last_sync_at ?? null,
        });
        setPhase('configure');
      }
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const manualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
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
        toast({ title: "Check failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        documentsSaved: data.totalTracked ?? prev.documentsSaved,
        lastSyncAt: new Date().toISOString(),
      } : null);

      if (data.newDocs > 0) {
        toast({ title: `${data.newDocs} new document(s) saved` });
      } else {
        toast({ title: "No new documents found" });
      }
      return true;
    } catch (err) {
      console.error('Error polling:', err);
      toast({ title: "Check failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsPolling(false);
    }
  }, [toast]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please log in to activate monitoring", variant: "destructive" });
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
      } : null);
      setPhase('active');
      toast({ title: "Monitoring activated", description: "New Google Docs will be saved automatically" });
      return true;
    } catch (err) {
      console.error('Error activating monitoring:', err);
      toast({ title: "Activation failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, toast]);

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
      toast({ title: "Monitoring paused", description: "Automatic tracking has been stopped" });
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
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    loadConfig, activateMonitoring, deactivateMonitoring, manualPoll, reset,
  };
}
