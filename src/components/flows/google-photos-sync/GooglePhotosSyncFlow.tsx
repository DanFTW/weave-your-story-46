import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGooglePhotosSync } from "@/hooks/useGooglePhotosSync";
import { useComposio } from "@/hooks/useComposio";
import { GooglePhotosSyncConfig } from "./GooglePhotosSyncConfig";
import { GooglePhotosSyncActive } from "./GooglePhotosSyncActive";
import { SyncingScreen } from "./SyncingScreen";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function GooglePhotosSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const googlePhotos = useComposio('GOOGLEPHOTOS');
  
  const {
    phase,
    setPhase,
    syncConfig,
    recentPhotos,
    isSyncing,
    isLoading,
    isSavingConfig,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentPhotos,
    // Album-related
    albums,
    selectedAlbumIds,
    albumPhotos,
    isLoadingAlbums,
    fetchAlbums,
    fetchAlbumPhotos,
    setSelectedAlbumIds,
  } = useGooglePhotosSync();

  // Check Google Photos connection status
  useEffect(() => {
    const checkAuth = async () => {
      await googlePhotos.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (googlePhotos.isConnected) {
      // Load existing config
      loadConfig();
      // Fetch albums
      fetchAlbums();
      // Fetch recent photos for preview
      fetchRecentPhotos();
    } else {
      // User is not connected, redirect to Google Photos integration
      navigate('/integration/googlephotos');
    }
  }, [googlePhotos.isConnected, isCheckingAuth]);

  const handleBack = () => {
    switch (phase) {
      case 'auth-check':
      case 'configure':
        navigate('/threads');
        break;
      case 'active':
        navigate('/threads');
        break;
      default:
        navigate('/threads');
    }
  };

  const handleSaveConfig = async (config: { 
    syncNewPhotos: boolean; 
    autoCreateMemories: boolean;
    selectedAlbumIds: string[];
  }) => {
    await saveConfig({
      syncNewPhotos: config.syncNewPhotos,
      autoCreateMemories: config.autoCreateMemories,
      selectedAlbumIds: config.selectedAlbumIds.length > 0 ? config.selectedAlbumIds : null,
    });
  };

  const handleStartSync = () => {
    syncNow();
  };

  // Loading state
  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            {isCheckingAuth ? "Checking connection..." : "Loading settings..."}
          </p>
        </div>
      </div>
    );
  }

  // Syncing screen
  if (phase === 'syncing') {
    return (
      <div className="min-h-screen bg-background">
        <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Camera className="w-6 h-6 text-white" />
            </div>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Photos Dump</h1>
              <p className="text-white/70 text-sm truncate">Dumping photos...</p>
            </div>
          </div>
        </div>
        <SyncingScreen />
      </div>
    );
  }

  // Get subtitle based on phase
  const getSubtitle = () => {
    switch (phase) {
      case 'configure':
        return 'Set up your preferences';
      case 'active':
        return `${syncConfig?.memoriesCreatedCount || 0} memories created`;
      default:
        return 'Sync photos to memory';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Photos Dump</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'configure' && (
          <GooglePhotosSyncConfig
            syncNewPhotos={syncConfig?.syncNewPhotos ?? true}
            autoCreateMemories={syncConfig?.autoCreateMemories ?? true}
            isSaving={isSavingConfig}
            albums={albums}
            selectedAlbumIds={selectedAlbumIds}
            albumPhotos={albumPhotos}
            isLoadingAlbums={isLoadingAlbums}
            onSave={handleSaveConfig}
            onStartSync={handleStartSync}
            onAlbumSelectionChange={setSelectedAlbumIds}
            onLoadAlbumPhotos={fetchAlbumPhotos}
          />
        )}

        {phase === 'active' && syncConfig && (
          <GooglePhotosSyncActive
            syncConfig={syncConfig}
            recentPhotos={recentPhotos}
            isSyncing={isSyncing}
            albums={albums}
            onSyncNow={syncNow}
            onConfigure={() => setPhase('configure')}
          />
        )}
      </div>
    </div>
  );
}
