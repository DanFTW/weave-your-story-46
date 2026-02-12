import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FirefliesAutomationPhase,
  FirefliesAutomationConfig,
  FirefliesAutomationStats,
} from "@/types/firefliesAutomation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function useFirefliesAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<FirefliesAutomationPhase>('auth-check');
  const [config, setConfig] = useState<FirefliesAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);

  const stats: FirefliesAutomationStats = {
    transcriptsSaved: config?.transcriptsSaved ?? 0,
    isActive: config?.isActive ?? false,
    lastReceivedAt: config?.lastReceivedAt ?? null,
    webhookUrl,
    webhookSecret,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('fireflies_automation_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading fireflies config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          webhookToken: d.webhook_token, webhookSecret: d.webhook_secret,
          transcriptsSaved: d.transcripts_saved ?? 0,
          lastReceivedAt: d.last_received_at ?? null,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        if (d.webhook_token) {
          setWebhookUrl(`${SUPABASE_URL}/functions/v1/fireflies-webhook/${d.webhook_token}`);
          setWebhookSecret(d.webhook_secret);
        }
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('fireflies_automation_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          webhookToken: n.webhook_token, webhookSecret: n.webhook_secret,
          transcriptsSaved: n.transcripts_saved ?? 0,
          lastReceivedAt: n.last_received_at ?? null,
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

      const { data, error } = await supabase.functions.invoke('fireflies-automation-triggers', {
        body: { action: 'activate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setWebhookUrl(data.webhookUrl);
      setWebhookSecret(data.webhookSecret);
      setConfig(prev => prev ? { ...prev, isActive: true, webhookToken: data.webhookToken, webhookSecret: data.webhookSecret } : null);
      setPhase('active');
      toast({ title: "Monitoring activated", description: "Paste the webhook URL into Fireflies" });
      return true;
    } catch (err) {
      console.error('Error activating:', err);
      toast({ title: "Activation failed", variant: "destructive" });
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

      const { error } = await supabase.functions.invoke('fireflies-automation-triggers', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "Webhook events will be ignored" });
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
    phase, setPhase, config, stats, isLoading, isActivating,
    loadConfig, activateMonitoring, deactivateMonitoring, reset,
  };
}
