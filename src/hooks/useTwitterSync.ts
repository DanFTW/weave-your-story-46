import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  TwitterSyncPhase, 
  TwitterSyncConfig, 
  Tweet, 
  TwitterSyncResult 
} from "@/types/twitterSync";

interface UseTwitterSyncReturn {
  // State
  phase: TwitterSyncPhase;
  setPhase: (phase: TwitterSyncPhase) => void;
  syncConfig: TwitterSyncConfig | null;
  recentTweets: Tweet[];
  isSyncing: boolean;
  isLoading: boolean;
  isSavingConfig: boolean;
  lastSyncResult: TwitterSyncResult | null;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<TwitterSyncConfig>) => Promise<boolean>;
  syncNow: () => Promise<TwitterSyncResult | null>;
  fetchRecentTweets: () => Promise<void>;
  resetSync: () => Promise<boolean>;
}

export function useTwitterSync(): UseTwitterSyncReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<TwitterSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<TwitterSyncConfig | null>(null);
  const [recentTweets, setRecentTweets] = useState<Tweet[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<TwitterSyncResult | null>(null);

  // Load sync configuration from database
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('twitter_sync_config')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        const config: TwitterSyncConfig = {
          id: data.id,
          userId: data.user_id,
          syncTweets: data.sync_tweets,
          syncRetweets: data.sync_retweets,
          syncReplies: data.sync_replies,
          syncLikes: data.sync_likes,
          lastSyncAt: data.last_sync_at,
          lastSyncedTweetId: data.last_synced_tweet_id,
          tweetsSyncedCount: data.tweets_synced_count,
          memoriesCreatedCount: data.memories_created_count,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setSyncConfig(config);
        
        if (config.lastSyncAt) {
          setPhase('active');
        } else {
          setPhase('configure');
        }
      } else {
        setPhase('configure');
      }
    } catch (error) {
      console.error('Failed to load sync config:', error);
      toast({
        title: "Load failed",
        description: "Could not load sync configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Save sync configuration
  const saveConfig = useCallback(async (configUpdate: Partial<TwitterSyncConfig>): Promise<boolean> => {
    setIsSavingConfig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData = {
        user_id: session.user.id,
        sync_tweets: configUpdate.syncTweets ?? true,
        sync_retweets: configUpdate.syncRetweets ?? true,
        sync_replies: configUpdate.syncReplies ?? true,
        sync_likes: configUpdate.syncLikes ?? true,
        updated_at: new Date().toISOString(),
      };

      if (syncConfig?.id) {
        const { error } = await supabase
          .from('twitter_sync_config')
          .update(updateData)
          .eq('id', syncConfig.id);
          
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('twitter_sync_config')
          .insert(updateData)
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          setSyncConfig({
            id: data.id,
            userId: data.user_id,
            syncTweets: data.sync_tweets,
            syncRetweets: data.sync_retweets,
            syncReplies: data.sync_replies,
            syncLikes: data.sync_likes,
            lastSyncAt: data.last_sync_at,
            lastSyncedTweetId: data.last_synced_tweet_id,
            tweetsSyncedCount: data.tweets_synced_count,
            memoriesCreatedCount: data.memories_created_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
        }
      }

      toast({
        title: "Settings saved",
        description: "Your sync preferences have been updated.",
      });
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: "Save failed",
        description: "Could not save sync configuration.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  }, [syncConfig, toast]);

  // Fetch recent tweets from Twitter
  const fetchRecentTweets = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('twitter-sync', {
        body: { action: 'list-tweets', limit: 12 },
      });

      if (error) throw error;

      if (data?.tweets) {
        setRecentTweets(data.tweets);
      }
    } catch (error) {
      console.error('Failed to fetch recent tweets:', error);
    }
  }, []);

  // Sync tweets now
  const syncNow = useCallback(async (): Promise<TwitterSyncResult | null> => {
    setIsSyncing(true);
    setPhase('syncing');
    
    try {
      const { data, error } = await supabase.functions.invoke('twitter-sync', {
        body: { action: 'sync' },
      });

      if (error) throw error;

      const result: TwitterSyncResult = {
        success: data?.success ?? false,
        tweetsSynced: data?.tweetsSynced ?? 0,
        memoriesCreated: data?.memoriesCreated ?? 0,
        error: data?.error,
      };

      setLastSyncResult(result);

      if (result.success) {
        toast({
          title: "Sync complete",
          description: `Synced ${result.tweetsSynced} tweet${result.tweetsSynced !== 1 ? 's' : ''} and created ${result.memoriesCreated} memor${result.memoriesCreated !== 1 ? 'ies' : 'y'}.`,
        });
        
        await loadConfig();
        setPhase('active');
      } else {
        throw new Error(result.error || 'Sync failed');
      }

      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Could not sync tweets.",
        variant: "destructive",
      });
      setPhase('active');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  // Reset sync state to allow re-syncing existing tweets
  const resetSync = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('twitter-sync', {
        body: { action: 'reset-sync' },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sync reset",
          description: "You can now re-sync your tweets.",
        });
        await loadConfig();
        setPhase('configure');
        return true;
      }
      
      throw new Error(data?.error || 'Reset failed');
    } catch (error) {
      console.error('Reset sync failed:', error);
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Could not reset sync state.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast, loadConfig]);

  return {
    phase,
    setPhase,
    syncConfig,
    recentTweets,
    isSyncing,
    isLoading,
    isSavingConfig,
    lastSyncResult,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentTweets,
    resetSync,
  };
}
