import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { YouTubeSyncPhase, YouTubeSyncConfig, YouTubeVideo, YouTubeSyncResult } from '@/types/youtubeSync';

interface UseYouTubeSyncReturn {
  phase: YouTubeSyncPhase;
  setPhase: (phase: YouTubeSyncPhase) => void;
  syncConfig: YouTubeSyncConfig | null;
  recentVideos: YouTubeVideo[];
  isSyncing: boolean;
  isLoading: boolean;
  isSavingConfig: boolean;
  lastSyncResult: YouTubeSyncResult | null;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<YouTubeSyncConfig>) => Promise<void>;
  syncNow: () => Promise<void>;
  fetchRecentVideos: () => Promise<void>;
  resetSync: () => Promise<void>;
}

export function useYouTubeSync(): UseYouTubeSyncReturn {
  const [phase, setPhase] = useState<YouTubeSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<YouTubeSyncConfig | null>(null);
  const [recentVideos, setRecentVideos] = useState<YouTubeVideo[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<YouTubeSyncResult | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('youtube_sync_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSyncConfig({
          id: data.id,
          userId: data.user_id,
          syncLikedVideos: data.sync_liked_videos,
          syncWatchHistory: data.sync_watch_history,
          syncSubscriptions: data.sync_subscriptions,
          lastSyncAt: data.last_sync_at,
          lastSyncedVideoId: data.last_synced_video_id,
          videosSyncedCount: data.videos_synced_count,
          memoriesCreatedCount: data.memories_created_count,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
        setPhase(data.last_sync_at ? 'active' : 'configure');
      } else {
        setPhase('configure');
      }
    } catch (error) {
      console.error('Error loading YouTube sync config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load YouTube sync settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (config: Partial<YouTubeSyncConfig>) => {
    try {
      setIsSavingConfig(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbConfig = {
        user_id: user.id,
        sync_liked_videos: config.syncLikedVideos ?? true,
        sync_watch_history: config.syncWatchHistory ?? true,
        sync_subscriptions: config.syncSubscriptions ?? false,
      };

      const { data, error } = await supabase
        .from('youtube_sync_config')
        .upsert(dbConfig, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setSyncConfig({
        id: data.id,
        userId: data.user_id,
        syncLikedVideos: data.sync_liked_videos,
        syncWatchHistory: data.sync_watch_history,
        syncSubscriptions: data.sync_subscriptions,
        lastSyncAt: data.last_sync_at,
        lastSyncedVideoId: data.last_synced_video_id,
        videosSyncedCount: data.videos_synced_count,
        memoriesCreatedCount: data.memories_created_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });

      toast({
        title: 'Settings saved',
        description: 'Your YouTube sync preferences have been updated.',
      });
    } catch (error) {
      console.error('Error saving YouTube sync config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save YouTube sync settings',
        variant: 'destructive',
      });
    } finally {
      setIsSavingConfig(false);
    }
  }, []);

  const fetchRecentVideos = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-sync', {
        body: { action: 'list-videos' },
      });

      if (error) throw error;

      if (data?.videos) {
        setRecentVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching recent videos:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    try {
      setIsSyncing(true);
      setPhase('syncing');

      const { data, error } = await supabase.functions.invoke('youtube-sync', {
        body: { action: 'sync' },
      });

      if (error) throw error;

      setLastSyncResult({
        success: true,
        videosSynced: data?.videosSynced || 0,
        memoriesCreated: data?.memoriesCreated || 0,
      });

      // Reload config to get updated stats
      await loadConfig();
      await fetchRecentVideos();
      setPhase('active');

      toast({
        title: 'Sync complete',
        description: `Synced ${data?.videosSynced || 0} videos, created ${data?.memoriesCreated || 0} memories.`,
      });
    } catch (error) {
      console.error('Error syncing YouTube:', error);
      setLastSyncResult({
        success: false,
        videosSynced: 0,
        memoriesCreated: 0,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
      setPhase('active');
      toast({
        title: 'Sync failed',
        description: 'Failed to sync YouTube videos. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [loadConfig, fetchRecentVideos]);

  const resetSync = useCallback(async () => {
    try {
      setIsSyncing(true);

      const { error } = await supabase.functions.invoke('youtube-sync', {
        body: { action: 'reset-sync' },
      });

      if (error) throw error;

      await loadConfig();
      setPhase('configure');

      toast({
        title: 'Sync reset',
        description: 'Your YouTube sync has been reset. You can now re-sync all videos.',
      });
    } catch (error) {
      console.error('Error resetting YouTube sync:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset YouTube sync',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [loadConfig]);

  return {
    phase,
    setPhase,
    syncConfig,
    recentVideos,
    isSyncing,
    isLoading,
    isSavingConfig,
    lastSyncResult,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentVideos,
    resetSync,
  };
}
