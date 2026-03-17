import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  FacebookPagePostsPhase,
  FacebookPagePostsConfig,
  FacebookPagePostsStats,
  SyncedPagePost,
} from "@/types/facebookPagePosts";

export function useFacebookPagePosts() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<FacebookPagePostsPhase>('auth-check');
  const [config, setConfig] = useState<FacebookPagePostsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [syncedPosts, setSyncedPosts] = useState<SyncedPagePost[]>([]);

  const stats: FacebookPagePostsStats = {
    postsSynced: config?.postsSynced ?? 0,
    isActive: config?.isActive ?? false,
    lastPolledAt: config?.lastPolledAt ?? null,
  };

  const loadSyncedPosts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('facebook_synced_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('synced_at', { ascending: false })
      .limit(50);

    if (data) {
      setSyncedPosts(data.map((p: any) => ({
        id: p.id,
        facebookPostId: p.facebook_post_id,
        postMessage: p.post_message ?? null,
        memoryId: p.memory_id,
        syncedAt: p.synced_at,
      })));
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('facebook_page_posts_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading facebook page posts config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, isActive: d.is_active,
          postsSynced: d.posts_synced ?? 0,
          lastPolledAt: d.last_polled_at ?? null,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('facebook_page_posts_config' as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, isActive: n.is_active,
          postsSynced: n.posts_synced ?? 0,
          lastPolledAt: n.last_polled_at ?? null,
          createdAt: n.created_at, updatedAt: n.updated_at,
        });
        setPhase('configure');
      }

      await loadSyncedPosts();
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast, loadSyncedPosts]);

  const manualPoll = useCallback(async (): Promise<boolean> => {
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('facebook-page-posts', {
        body: { action: 'poll' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const errMsg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : 'Unknown error';
        toast({ title: "Poll failed", description: errMsg, variant: "destructive" });
        return false;
      }

      if (data?.error) {
        toast({ title: "Poll failed", description: data.error, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        postsSynced: data.totalSynced ?? prev.postsSynced,
        lastPolledAt: new Date().toISOString(),
      } : null);

      await loadSyncedPosts();

      if (data.newPosts > 0) {
        toast({ title: `${data.newPosts} new post(s) saved as memories` });
      } else {
        toast({ title: "No new posts", description: "Everything is up to date" });
      }
      return true;
    } catch (err) {
      console.error('Error polling:', err);
      toast({ title: "Poll failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsPolling(false);
    }
  }, [toast, loadSyncedPosts]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('facebook-page-posts', {
        body: { action: 'activate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      if (data?.error) {
        toast({ title: "Activation failed", description: data.error, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? {
        ...prev,
        isActive: true,
        postsSynced: data.totalSynced ?? prev.postsSynced,
        lastPolledAt: new Date().toISOString(),
      } : null);
      setPhase('active');

      await loadSyncedPosts();

      toast({ title: "Monitoring activated", description: "Facebook Page posts will be tracked" });
      return true;
    } catch (err) {
      console.error('Error activating monitoring:', err);
      toast({ title: "Activation failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, toast, loadSyncedPosts]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke('facebook-page-posts', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "Post tracking has been stopped" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, toast]);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling, syncedPosts,
    loadConfig, activateMonitoring, deactivateMonitoring, manualPoll, loadSyncedPosts,
  };
}
