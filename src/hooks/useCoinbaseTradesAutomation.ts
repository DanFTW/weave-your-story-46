import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CoinbaseTradesPhase,
  CoinbaseTradesConfig,
  CoinbaseTradesStats,
  CoinbaseTradesUpdatePayload,
} from "@/types/coinbaseTradesAutomation";

export function useCoinbaseTradesAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<CoinbaseTradesPhase>('auth-check');
  const [config, setConfig] = useState<CoinbaseTradesConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: CoinbaseTradesStats = {
    tradesTracked: config?.tradesTracked ?? 0,
    isActive: config?.isActive ?? false,
    lastPolledAt: config?.lastPolledAt ?? null,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('coinbase_trades_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading coinbase trades config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          tradesTracked: d.trades_tracked ?? 0,
          lastPolledAt: d.last_polled_at ?? null,
          lastTradeTimestamp: d.last_trade_timestamp ?? null,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('coinbase_trades_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          tradesTracked: n.trades_tracked ?? 0,
          lastPolledAt: n.last_polled_at ?? null,
          lastTradeTimestamp: n.last_trade_timestamp ?? null,
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

  const updateConfig = useCallback(async (updates: CoinbaseTradesUpdatePayload): Promise<boolean> => {
    if (!config) return false;
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      const { error } = await supabase
        .from('coinbase_trades_config' as any)
        .update(dbUpdates)
        .eq('id', config.id);

      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return false;
      }
      setConfig(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err) {
      console.error('Error updating config:', err);
      return false;
    }
  }, [config, toast]);

  const manualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('coinbase-trades-poll', {
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
        tradesTracked: data.totalTracked ?? prev.tradesTracked,
        lastPolledAt: new Date().toISOString(),
      } : null);

      if (data.newTrades > 0) {
        toast({ title: `${data.newTrades} new trade(s) tracked` });
      } else {
        toast({ title: "No new trades found", description: "All trades are up to date" });
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

      const { data, error } = await supabase.functions.invoke('coinbase-trades-poll', {
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
        tradesTracked: data.totalTracked ?? prev.tradesTracked,
        lastPolledAt: new Date().toISOString(),
      } : null);
      setPhase('active');
      toast({ title: "Monitoring activated", description: "Your Coinbase trades will be tracked" });
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

      const { error } = await supabase.functions.invoke('coinbase-trades-poll', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      await updateConfig({ isActive: false });
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "Trade tracking has been stopped" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, updateConfig, toast]);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    loadConfig, updateConfig, activateMonitoring, deactivateMonitoring, manualPoll,
  };
}
