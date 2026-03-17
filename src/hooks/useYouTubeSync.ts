import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { YouTubeSyncPhase, YouTubeSyncConfig, YouTubeVideo, YouTubeSyncResult } from '@/types/youtubeSync';

export interface SyncHistoryItem {
  id: string;
  videoTitle: string | null;
  videoCategory: string | null;
  syncedAt: string;
  youtubeVideoId: string;
}

interface UseYouTubeSyncReturn {
  phase: YouTubeSyncPhase;
  setPhase: (phase: YouTubeSyncPhase) => void;
  syncConfig: YouTubeSyncConfig | null;
  recentVideos: YouTubeVideo[];
  syncHistory: SyncHistoryItem[];
  isSyncing: boolean;
  isLoading: boolean;
  isSavingConfig: boolean;
  lastSyncResult: YouTubeSyncResult | null;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<YouTubeSyncConfig>) => Promise<void>;
  syncNow: () => Promise<void>;
  fetchRecentVideos: () => Promise<void>;
  resetSync: () => Promise<void>;
  loadSyncHistory: () => Promise<void>;
}

export function useYouTubeSync(): UseYouTubeSyncReturn {
  const [phase, setPhase] = useState<YouTubeSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<YouTubeSyncConfig | null>(null);
  const [recentVideos, setRecentVideos] = useState<YouTubeVideo[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<YouTubeSyncResult | null>(null);

  const loadSyncHistory = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('youtube_synced_posts')
        .select('id, video_title, video_category, synced_at, youtube_video_id')
        .eq('user_id', user.id)
        .order('synced_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setSyncHistory(
        (data || []).map((row) => ({
          id: row.id,
          videoTitle: row.video_title,
          videoCategory: row.video_category,
          syncedAt: row.synced_at || new Date().toISOString(),
          youtubeVideoId: row.youtube_video_id,
        }))
      );
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  }, []);

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
        const newPhase = data.last_sync_at ? 'active' : 'configure';
        setPhase(newPhase);
        if (newPhase === 'active') {
          // Fire and forget — don't block loadConfig
          loadSyncHistory();
        }
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
  }, [loadSyncHistory]);

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
      await Promise.all([fetchRecentVideos(), loadSyncHistory()]);
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
  }, [loadConfig, fetchRecentVideos, loadSyncHistory]);

  const resetSync = useCallback(async () => {
    try {
      setIsSyncing(true);

      const { error } = await supabase.functions.invoke('youtube-sync', {
        body: { action: 'reset-sync' },
      });

      if (error) throw error;

      await loadConfig();
      setSyncHistory([]);
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
    syncHistory,
    isSyncing,
    isLoading,
    isSavingConfig,
    lastSyncResult,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentVideos,
    resetSync,
    loadSyncHistory,
  };
}
