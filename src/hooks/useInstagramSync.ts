import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  InstagramSyncPhase, 
  InstagramSyncConfig, 
  InstagramPost, 
  InstagramSyncResult 
} from "@/types/instagramSync";

interface UseInstagramSyncReturn {
  phase: InstagramSyncPhase;
  setPhase: (phase: InstagramSyncPhase) => void;
  syncConfig: InstagramSyncConfig | null;
  recentPosts: InstagramPost[];
  isSyncing: boolean;
  isLoading: boolean;
  isSavingConfig: boolean;
  lastSyncResult: InstagramSyncResult | null;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<InstagramSyncConfig>) => Promise<boolean>;
  syncNow: () => Promise<InstagramSyncResult | null>;
  fetchRecentPosts: () => Promise<void>;
  resetSync: () => Promise<boolean>;
}

export function useInstagramSync(): UseInstagramSyncReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<InstagramSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<InstagramSyncConfig | null>(null);
  const [recentPosts, setRecentPosts] = useState<InstagramPost[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<InstagramSyncResult | null>(null);

  const mapConfig = (data: any): InstagramSyncConfig => ({
    id: data.id,
    userId: data.user_id,
    syncPosts: data.sync_posts,
    syncComments: data.sync_comments,
    syncStories: data.sync_stories ?? true,
    lastSyncAt: data.last_sync_at,
    lastSyncedPostId: data.last_synced_post_id,
    postsSyncedCount: data.posts_synced_count,
    memoriesCreatedCount: data.memories_created_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  });

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('instagram_sync_config')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const config = mapConfig(data);
        setSyncConfig(config);
        setPhase(config.lastSyncAt ? 'active' : 'configure');
      } else {
        setPhase('configure');
      }
    } catch (error) {
      console.error('Failed to load sync config:', error);
      toast({ title: "Load failed", description: "Could not load sync configuration.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveConfig = useCallback(async (configUpdate: Partial<InstagramSyncConfig>): Promise<boolean> => {
    setIsSavingConfig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData = {
        user_id: session.user.id,
        sync_posts: configUpdate.syncPosts ?? true,
        sync_comments: configUpdate.syncComments ?? true,
        sync_stories: configUpdate.syncStories ?? true,
        updated_at: new Date().toISOString(),
      };

      if (syncConfig?.id) {
        const { error } = await supabase
          .from('instagram_sync_config').update(updateData).eq('id', syncConfig.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('instagram_sync_config').insert(updateData).select().single();
        if (error) throw error;
        if (data) setSyncConfig(mapConfig(data));
      }

      toast({ title: "Settings saved", description: "Your sync preferences have been updated." });
      return true;
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({ title: "Save failed", description: "Could not save sync configuration.", variant: "destructive" });
      return false;
    } finally {
      setIsSavingConfig(false);
    }
  }, [syncConfig, toast]);

  const fetchRecentPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-sync', {
        body: { action: 'list-posts', limit: 12 },
      });
      if (error) throw error;
      if (data?.posts) setRecentPosts(data.posts);
    } catch (error) {
      console.error('Failed to fetch recent posts:', error);
    }
  }, []);

  const syncNow = useCallback(async (): Promise<InstagramSyncResult | null> => {
    setIsSyncing(true);
    setPhase('syncing');
    
    try {
      const { data, error } = await supabase.functions.invoke('instagram-sync', {
        body: { action: 'sync' },
      });
      if (error) throw error;

      const result: InstagramSyncResult = {
        success: data?.success ?? false,
        postsSynced: data?.postsSynced ?? 0,
        commentsSynced: data?.commentsSynced ?? 0,
        storiesSynced: data?.storiesSynced ?? 0,
        memoriesCreated: data?.memoriesCreated ?? 0,
        skippedDuplicates: data?.skippedDuplicates ?? 0,
        error: data?.error,
      };

      setLastSyncResult(result);

      if (result.success) {
        const parts: string[] = [];
        if (result.postsSynced) parts.push(`${result.postsSynced} post${result.postsSynced !== 1 ? 's' : ''}`);
        if (result.storiesSynced) parts.push(`${result.storiesSynced} stor${result.storiesSynced !== 1 ? 'ies' : 'y'}`);
        
        let description = parts.length
          ? `Synced ${parts.join(' and ')} and created ${result.memoriesCreated} memor${result.memoriesCreated !== 1 ? 'ies' : 'y'}.`
          : result.skippedDuplicates
            ? `All ${result.skippedDuplicates} items already synced. No new memories needed.`
            : 'No items found to sync.';

        toast({ title: "Sync complete", description });
        
        await loadConfig();
        setPhase('active');
      } else {
        throw new Error(result.error || 'Sync failed');
      }

      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      toast({ title: "Sync failed", description: error instanceof Error ? error.message : "Could not sync.", variant: "destructive" });
      setPhase('active');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  const resetSync = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('instagram-sync', {
        body: { action: 'force-reset-sync' },
      });
      if (error) throw error;

      if (data?.success) {
        toast({ title: "Full reset complete", description: "All posts will be re-synced as new memories." });
        await loadConfig();
        setPhase('configure');
        return true;
      }
      throw new Error(data?.error || 'Reset failed');
    } catch (error) {
      console.error('Force reset sync failed:', error);
      toast({ title: "Reset failed", description: error instanceof Error ? error.message : "Could not reset sync state.", variant: "destructive" });
      return false;
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, syncConfig, recentPosts, isSyncing, isLoading,
    isSavingConfig, lastSyncResult, loadConfig, saveConfig, syncNow, fetchRecentPosts, resetSync,
  };
}
