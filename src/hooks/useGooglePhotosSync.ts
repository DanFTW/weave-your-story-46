import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  GooglePhotosSyncPhase, 
  SyncConfig, 
  PhotoItem, 
  SyncResult,
  Album
} from "@/types/googlePhotosSync";

interface UseGooglePhotosSyncReturn {
  // State
  phase: GooglePhotosSyncPhase;
  setPhase: (phase: GooglePhotosSyncPhase) => void;
  syncConfig: SyncConfig | null;
  recentPhotos: PhotoItem[];
  isSyncing: boolean;
  isLoading: boolean;
  isSavingConfig: boolean;
  lastSyncResult: SyncResult | null;
  
  // Album state
  albums: Album[];
  selectedAlbumIds: string[];
  albumPhotos: Record<string, PhotoItem[]>;
  isLoadingAlbums: boolean;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<SyncConfig>) => Promise<boolean>;
  syncNow: () => Promise<SyncResult | null>;
  fetchRecentPhotos: () => Promise<void>;
  
  // Album actions
  fetchAlbums: () => Promise<void>;
  fetchAlbumPhotos: (albumId: string) => Promise<PhotoItem[]>;
  setSelectedAlbumIds: (ids: string[]) => void;
}

export function useGooglePhotosSync(): UseGooglePhotosSyncReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<GooglePhotosSyncPhase>('auth-check');
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null);
  const [recentPhotos, setRecentPhotos] = useState<PhotoItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  
  // Album state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<string[]>([]);
  const [albumPhotos, setAlbumPhotos] = useState<Record<string, PhotoItem[]>>({});
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  // Load sync configuration from database
  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('google_photos_sync_config')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected for new users
        throw error;
      }

      if (data) {
        const config: SyncConfig = {
          id: data.id,
          userId: data.user_id,
          syncNewPhotos: data.sync_new_photos,
          autoCreateMemories: data.auto_create_memories,
          lastSyncAt: data.last_sync_at,
          lastSyncedPhotoId: data.last_synced_photo_id,
          photosSyncedCount: data.photos_synced_count,
          memoriesCreatedCount: data.memories_created_count,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          selectedAlbumIds: data.selected_album_ids,
        };
        setSyncConfig(config);
        setSelectedAlbumIds(config.selectedAlbumIds || []);
        
        // If config exists and has synced before, go to active phase
        if (config.lastSyncAt) {
          setPhase('active');
        } else {
          setPhase('configure');
        }
      } else {
        // No config yet, stay in configure phase
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

  // Fetch albums from Google Photos
  const fetchAlbums = useCallback(async () => {
    setIsLoadingAlbums(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-sync', {
        body: { action: 'list-albums' },
      });

      if (error) throw error;

      if (data?.albums) {
        setAlbums(data.albums);
      }
    } catch (error) {
      console.error('Failed to fetch albums:', error);
      toast({
        title: "Failed to load albums",
        description: "Could not fetch your Google Photos albums.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAlbums(false);
    }
  }, [toast]);

  // Fetch photos from a specific album
  const fetchAlbumPhotos = useCallback(async (albumId: string): Promise<PhotoItem[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-sync', {
        body: { action: 'list-album-photos', albumId, limit: 20 },
      });

      if (error) throw error;

      const photos = data?.photos || [];
      
      // Cache the photos
      setAlbumPhotos(prev => ({
        ...prev,
        [albumId]: photos,
      }));

      return photos;
    } catch (error) {
      console.error('Failed to fetch album photos:', error);
      return [];
    }
  }, []);

  // Save sync configuration
  const saveConfig = useCallback(async (configUpdate: Partial<SyncConfig>): Promise<boolean> => {
    setIsSavingConfig(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updateData = {
        user_id: session.user.id,
        sync_new_photos: configUpdate.syncNewPhotos ?? true,
        auto_create_memories: configUpdate.autoCreateMemories ?? true,
        selected_album_ids: configUpdate.selectedAlbumIds ?? null,
        updated_at: new Date().toISOString(),
      };

      if (syncConfig?.id) {
        // Update existing config
        const { error } = await supabase
          .from('google_photos_sync_config')
          .update(updateData)
          .eq('id', syncConfig.id);
          
        if (error) throw error;
      } else {
        // Insert new config
        const { data, error } = await supabase
          .from('google_photos_sync_config')
          .insert(updateData)
          .select()
          .single();
          
        if (error) throw error;
        
        if (data) {
          setSyncConfig({
            id: data.id,
            userId: data.user_id,
            syncNewPhotos: data.sync_new_photos,
            autoCreateMemories: data.auto_create_memories,
            lastSyncAt: data.last_sync_at,
            lastSyncedPhotoId: data.last_synced_photo_id,
            photosSyncedCount: data.photos_synced_count,
            memoriesCreatedCount: data.memories_created_count,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            selectedAlbumIds: data.selected_album_ids,
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

  // Fetch recent photos from Google Photos
  const fetchRecentPhotos = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-sync', {
        body: { action: 'list-photos', limit: 12 },
      });

      if (error) throw error;

      if (data?.photos) {
        setRecentPhotos(data.photos);
      }
    } catch (error) {
      console.error('Failed to fetch recent photos:', error);
    }
  }, []);

  // Sync photos now
  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    setIsSyncing(true);
    setPhase('syncing');
    
    try {
      const { data, error } = await supabase.functions.invoke('google-photos-sync', {
        body: { action: 'sync' },
      });

      if (error) throw error;

      const result: SyncResult = {
        success: data?.success ?? false,
        photosSynced: data?.photosSynced ?? 0,
        memoriesCreated: data?.memoriesCreated ?? 0,
        newLastSyncedPhotoId: data?.newLastSyncedPhotoId,
        error: data?.error,
      };

      setLastSyncResult(result);

      if (result.success) {
        toast({
          title: "Sync complete",
          description: `Synced ${result.photosSynced} photo${result.photosSynced !== 1 ? 's' : ''} and created ${result.memoriesCreated} memor${result.memoriesCreated !== 1 ? 'ies' : 'y'}.`,
        });
        
        // Reload config to get updated counts
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
        description: error instanceof Error ? error.message : "Could not sync photos.",
        variant: "destructive",
      });
      setPhase('active');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase,
    setPhase,
    syncConfig,
    recentPhotos,
    isSyncing,
    isLoading,
    isSavingConfig,
    lastSyncResult,
    albums,
    selectedAlbumIds,
    albumPhotos,
    isLoadingAlbums,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentPhotos,
    fetchAlbums,
    fetchAlbumPhotos,
    setSelectedAlbumIds,
  };
}
