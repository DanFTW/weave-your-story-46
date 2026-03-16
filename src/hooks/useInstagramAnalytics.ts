import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  InstagramAnalyticsPhase,
  InstagramAnalyticsConfig,
  InstagramAnalyticsStats,
} from "@/types/instagramAnalytics";

export function useInstagramAnalytics() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<InstagramAnalyticsPhase>('auth-check');
  const [config, setConfig] = useState<InstagramAnalyticsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: InstagramAnalyticsStats = {
    insightsCollected: config?.insightsCollected ?? 0,
    isActive: config?.isActive ?? false,
    lastPolledAt: config?.lastPolledAt ?? null,
  };

  const expiredConnectionMessage = 'Your Instagram connection expired. Please reconnect to continue.';

  const isExpiredConnectionError = (message: string) =>
    message.includes('ActionExecute_ConnectedAccountExpired') ||
    message.includes('is in EXPIRED state');

  const handleReconnectRequired = useCallback((message?: string) => {
    setPhase('needs-reconnect');
    toast({
      title: 'Reconnect Instagram',
      description: message || expiredConnectionMessage,
      variant: 'destructive',
    });
  }, [toast]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('instagram_analytics_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading instagram analytics config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          insightsCollected: d.insights_collected ?? 0,
          lastPolledAt: d.last_polled_at ?? null,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('instagram_analytics_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          insightsCollected: n.insights_collected ?? 0,
          lastPolledAt: n.last_polled_at ?? null,
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

  const manualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('instagram-analytics-poll', {
        body: { action: 'manual-poll' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const errMsg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : 'Unknown error';
        toast({ title: "Poll failed", description: errMsg, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        insightsCollected: data.totalCollected ?? prev.insightsCollected,
        lastPolledAt: new Date().toISOString(),
      } : null);

      if (data.newInsights > 0) {
        toast({ title: `${data.newInsights} new insight(s) collected` });
      } else {
        toast({ title: "No new insights", description: "Analytics are up to date" });
      }
      return true;
    } catch (err) {
      console.error('Error polling:', err);
      toast({ title: "Poll failed", description: "An unexpected error occurred", variant: "destructive" });
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
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('instagram-analytics-poll', {
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
        insightsCollected: data.totalCollected ?? prev.insightsCollected,
        lastPolledAt: new Date().toISOString(),
      } : null);
      setPhase('active');
      toast({ title: "Monitoring activated", description: "Instagram analytics will be tracked" });
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

      const { error } = await supabase.functions.invoke('instagram-analytics-poll', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "Analytics tracking has been stopped" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, toast]);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    loadConfig, activateMonitoring, deactivateMonitoring, manualPoll,
  };
}
