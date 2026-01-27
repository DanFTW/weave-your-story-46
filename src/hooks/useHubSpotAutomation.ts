import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  HubSpotAutomationPhase, 
  HubSpotAutomationConfig,
  HubSpotContactStats,
  HubSpotAutomationUpdatePayload
} from "@/types/hubspotAutomation";

interface UseHubSpotAutomationReturn {
  phase: HubSpotAutomationPhase;
  setPhase: (phase: HubSpotAutomationPhase) => void;
  config: HubSpotAutomationConfig | null;
  stats: HubSpotContactStats;
  isLoading: boolean;
  isActivating: boolean;
  isPolling: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: HubSpotAutomationUpdatePayload) => Promise<boolean>;
  activateMonitoring: () => Promise<boolean>;
  deactivateMonitoring: () => Promise<boolean>;
  triggerManualPoll: () => Promise<boolean>;
  reset: () => void;
}

export function useHubSpotAutomation(): UseHubSpotAutomationReturn {
  const { toast } = useToast();
  const [phase, setPhase] = useState<HubSpotAutomationPhase>('auth-check');
  const [config, setConfig] = useState<HubSpotAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: HubSpotContactStats = {
    contactsTracked: config?.contactsTracked ?? 0,
    lastChecked: config?.lastPolledAt ?? null,
    isActive: config?.isActive ?? false,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhase('auth-check');
        return;
      }

      // Check for existing config
      const { data, error } = await supabase
        .from('hubspot_automation_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading automation config:', error);
        toast({
          title: "Error loading config",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        const configData = data as any;
        setConfig({
          id: configData.id,
          userId: configData.user_id,
          monitorNewContacts: configData.monitor_new_contacts,
          isActive: configData.is_active,
          triggerId: configData.trigger_id,
          lastPolledAt: configData.last_polled_at,
          contactsTracked: configData.contacts_tracked ?? 0,
          createdAt: configData.created_at,
          updatedAt: configData.updated_at,
        });
        setPhase(configData.is_active ? 'active' : 'configure');
      } else {
        // Create default config
        const { data: newConfig, error: insertError } = await supabase
          .from('hubspot_automation_config' as any)
          .insert({
            user_id: user.id,
            monitor_new_contacts: true,
            is_active: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating config:', insertError);
          return;
        }

        const newConfigData = newConfig as any;
        setConfig({
          id: newConfigData.id,
          userId: newConfigData.user_id,
          monitorNewContacts: newConfigData.monitor_new_contacts,
          isActive: newConfigData.is_active,
          triggerId: newConfigData.trigger_id,
          lastPolledAt: newConfigData.last_polled_at,
          contactsTracked: newConfigData.contacts_tracked ?? 0,
          createdAt: newConfigData.created_at,
          updatedAt: newConfigData.updated_at,
        });
        setPhase('configure');
      }
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateConfig = useCallback(async (updates: HubSpotAutomationUpdatePayload): Promise<boolean> => {
    if (!config) return false;

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.monitorNewContacts !== undefined) dbUpdates.monitor_new_contacts = updates.monitorNewContacts;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      const { error } = await supabase
        .from('hubspot_automation_config' as any)
        .update(dbUpdates)
        .eq('id', config.id);

      if (error) {
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        ...updates,
      } : null);

      return true;
    } catch (err) {
      console.error('Error updating config:', err);
      return false;
    }
  }, [config, toast]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;

    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to activate monitoring",
          variant: "destructive",
        });
        return false;
      }

      // Call the edge function to activate
      const { data, error } = await supabase.functions.invoke('hubspot-automation-triggers', {
        body: { action: 'activate' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast({
          title: "Activation failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      await updateConfig({ isActive: true });
      setPhase('active');

      toast({
        title: "Monitoring activated",
        description: "Your HubSpot contacts will be tracked automatically",
      });

      return true;
    } catch (err) {
      console.error('Error activating monitoring:', err);
      toast({
        title: "Activation failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, updateConfig, toast]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke('hubspot-automation-triggers', {
        body: { action: 'deactivate' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast({
          title: "Deactivation failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      await updateConfig({ isActive: false });
      setPhase('configure');

      toast({
        title: "Monitoring paused",
        description: "Automatic tracking has been stopped",
      });

      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, updateConfig, toast]);

  const triggerManualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke('hubspot-automation-triggers', {
        body: { action: 'manual-poll' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast({
          title: "Check failed",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      // Reload config to get updated stats
      await loadConfig();

      const result = data as any;
      toast({
        title: "Check complete",
        description: `Found ${result?.newItems ?? 0} new contacts`,
      });

      return true;
    } catch (err) {
      console.error('Error in manual poll:', err);
      return false;
    } finally {
      setIsPolling(false);
    }
  }, [loadConfig, toast]);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setConfig(null);
  }, []);

  return {
    phase,
    setPhase,
    config,
    stats,
    isLoading,
    isActivating,
    isPolling,
    loadConfig,
    updateConfig,
    activateMonitoring,
    deactivateMonitoring,
    triggerManualPoll,
    reset,
  };
}
