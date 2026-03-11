import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  FacebookSyncPhase, 
  FacebookSyncConfig, 
  FacebookSyncResult 
} from "@/types/facebookSync";

interface UseFacebookSyncReturn {
  phase: FacebookSyncPhase;
  setPhase: (phase: FacebookSyncPhase) => void;
  syncConfig: FacebookSyncConfig | null;
  isSyncing: boolean;
  isLoading: boolean;
  lastSyncResult: FacebookSyncResult | null;
  loadConfig: () => Promise<void>;
  syncNow: () => Promise<FacebookSyncResult | null>;
  resetSync: () => Promise<boolean>;
}

export function useFacebookSync(): UseFacebookSyncReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<FacebookSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<FacebookSyncConfig | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<FacebookSyncResult | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('facebook_sync_config')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const config: FacebookSyncConfig = {
          id: data.id,
          userId: data.user_id,
          syncPosts: data.sync_posts,
          isActive: data.is_active,
          lastSyncAt: data.last_sync_at,
          lastSyncedPostId: data.last_synced_post_id,
          postsSyncedCount: data.posts_synced_count,
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
      console.error('Failed to load Facebook sync config:', error);
      toast({
        title: "Load failed",
        description: "Could not load sync configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const syncNow = useCallback(async (): Promise<FacebookSyncResult | null> => {
    setIsSyncing(true);
    setPhase('syncing');
    
    try {
      const { data, error } = await supabase.functions.invoke('facebook-sync', {
        body: { action: 'sync' },
      });

      if (error) throw error;

      const result: FacebookSyncResult = {
        success: data?.success ?? false,
        postsSynced: data?.postsSynced ?? 0,
        memoriesCreated: data?.memoriesCreated ?? 0,
        error: data?.error,
      };

      setLastSyncResult(result);

      if (result.success) {
        toast({
          title: "Sync complete",
          description: result.postsSynced > 0 
            ? `Imported ${result.memoriesCreated} new Facebook post${result.memoriesCreated !== 1 ? 's' : ''} as memories.`
            : "No new posts to import.",
        });
        
        await loadConfig();
        setPhase('active');
      } else {
        throw new Error(result.error || 'Sync failed');
      }

      return result;
    } catch (error) {
      console.error('Facebook sync failed:', error);
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Could not sync Facebook posts.",
        variant: "destructive",
      });
      setPhase(syncConfig?.lastSyncAt ? 'active' : 'configure');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig, syncConfig]);

  const resetSync = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('facebook-sync', {
        body: { action: 'reset-sync' },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Sync reset",
          description: "You can now re-sync your Facebook posts.",
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
    isSyncing,
    isLoading,
    lastSyncResult,
    loadConfig,
    syncNow,
    resetSync,
  };
}
