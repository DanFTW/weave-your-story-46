import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  InstagramAutomationPhase, 
  InstagramAutomationConfig,
  InstagramEngagementStats,
  InstagramAutomationUpdatePayload
} from "@/types/instagramAutomation";

interface UseInstagramAutomationReturn {
  phase: InstagramAutomationPhase;
  setPhase: (phase: InstagramAutomationPhase) => void;
  config: InstagramAutomationConfig | null;
  stats: InstagramEngagementStats;
  isLoading: boolean;
  isActivating: boolean;
  isPolling: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: InstagramAutomationUpdatePayload) => Promise<boolean>;
  activateMonitoring: () => Promise<boolean>;
  deactivateMonitoring: () => Promise<boolean>;
  triggerManualPoll: () => Promise<boolean>;
  reset: () => void;
}

export function useInstagramAutomation(): UseInstagramAutomationReturn {
  const { toast } = useToast();
  const [phase, setPhase] = useState<InstagramAutomationPhase>('auth-check');
  const [config, setConfig] = useState<InstagramAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: InstagramEngagementStats = {
    postsTracked: config?.postsTracked ?? 0,
    commentsTracked: config?.commentsTracked ?? 0,
    likesTracked: config?.likesTracked ?? 0,
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

      // Check for existing config - use type assertion since table is new
      const { data, error } = await supabase
        .from('instagram_automation_config' as any)
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
          monitorNewPosts: configData.monitor_new_posts,
          monitorComments: configData.monitor_comments,
          monitorLikes: configData.monitor_likes,
          isActive: configData.is_active,
          pollIntervalMinutes: configData.poll_interval_minutes,
          lastPolledAt: configData.last_polled_at,
          postsTracked: configData.posts_tracked,
          commentsTracked: configData.comments_tracked,
          likesTracked: configData.likes_tracked,
          createdAt: configData.created_at,
          updatedAt: configData.updated_at,
        });
        setPhase(configData.is_active ? 'active' : 'configure');
      } else {
        // Create default config
        const { data: newConfig, error: insertError } = await supabase
          .from('instagram_automation_config' as any)
          .insert({
            user_id: user.id,
            monitor_new_posts: true,
            monitor_comments: true,
            monitor_likes: true,
            is_active: false,
            poll_interval_minutes: 15,
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
          monitorNewPosts: newConfigData.monitor_new_posts,
          monitorComments: newConfigData.monitor_comments,
          monitorLikes: newConfigData.monitor_likes,
          isActive: newConfigData.is_active,
          pollIntervalMinutes: newConfigData.poll_interval_minutes,
          lastPolledAt: newConfigData.last_polled_at,
          postsTracked: newConfigData.posts_tracked ?? 0,
          commentsTracked: newConfigData.comments_tracked ?? 0,
          likesTracked: newConfigData.likes_tracked ?? 0,
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

  const updateConfig = useCallback(async (updates: InstagramAutomationUpdatePayload): Promise<boolean> => {
    if (!config) return false;

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.monitorNewPosts !== undefined) dbUpdates.monitor_new_posts = updates.monitorNewPosts;
      if (updates.monitorComments !== undefined) dbUpdates.monitor_comments = updates.monitorComments;
      if (updates.monitorLikes !== undefined) dbUpdates.monitor_likes = updates.monitorLikes;
      if (updates.pollIntervalMinutes !== undefined) dbUpdates.poll_interval_minutes = updates.pollIntervalMinutes;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      const { error } = await supabase
        .from('instagram_automation_config' as any)
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
      const { data, error } = await supabase.functions.invoke('instagram-automation-poll', {
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
        description: "Your Instagram activity will be tracked automatically",
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

      const { error } = await supabase.functions.invoke('instagram-automation-poll', {
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

      const { data, error } = await supabase.functions.invoke('instagram-automation-poll', {
        body: { action: 'manual-poll' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        // Check for connection expired (410)
        const errorMessage = error.message || '';
        if (errorMessage.includes('CONNECTION_EXPIRED') || errorMessage.includes('410')) {
          toast({
            title: "Connection expired",
            description: "Your Instagram connection has expired. Please reconnect.",
            variant: "destructive",
          });
          setPhase('auth-check');
          return false;
        }
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
        description: `Found ${result?.newItems ?? 0} new items`,
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
