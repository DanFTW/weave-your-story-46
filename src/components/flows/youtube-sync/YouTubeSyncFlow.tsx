import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, Play } from "lucide-react";
import { useYouTubeSync } from "@/hooks/useYouTubeSync";
import { useComposio } from "@/hooks/useComposio";
import { YouTubeSyncConfig } from "./YouTubeSyncConfig";
import { YouTubeSyncActive } from "./YouTubeSyncActive";
import { SyncingScreen } from "./SyncingScreen";

// YouTube logo component
function YouTubeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function YouTubeSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const youtube = useComposio('YOUTUBE');
  
  const {
    phase,
    setPhase,
    syncConfig,
    recentVideos,
    syncHistory,
    isSyncing,
    isLoading,
    isSavingConfig,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentVideos,
    resetSync,
  } = useYouTubeSync();

  // Check YouTube connection status
  useEffect(() => {
    const checkAuth = async () => {
      await youtube.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (youtube.isConnected) {
      loadConfig();
      fetchRecentVideos();
    } else {
      sessionStorage.setItem('returnAfterYoutubeConnect', '/flow/youtube-sync');
      navigate('/integration/youtube');
    }
  }, [youtube.isConnected, isCheckingAuth]);

  const handleBack = () => {
    navigate('/threads');
  };

  const handleSaveConfig = async (config: { 
    syncLikedVideos: boolean; 
    syncWatchHistory: boolean;
    syncSubscriptions: boolean;
  }) => {
    await saveConfig({
      syncLikedVideos: config.syncLikedVideos,
      syncWatchHistory: config.syncWatchHistory,
      syncSubscriptions: config.syncSubscriptions,
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
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
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
        <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-red-600 to-red-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <YouTubeLogo className="w-6 h-6 text-white" />
            </div>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">YouTube Dump</h1>
              <p className="text-white/70 text-sm truncate">Dumping videos...</p>
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
        return 'Sync videos to memory';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-red-600 to-red-900">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">YouTube Dump</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'configure' && (
          <YouTubeSyncConfig
            syncLikedVideos={syncConfig?.syncLikedVideos ?? true}
            syncWatchHistory={syncConfig?.syncWatchHistory ?? true}
            syncSubscriptions={syncConfig?.syncSubscriptions ?? false}
            isSaving={isSavingConfig}
            onSave={handleSaveConfig}
            onStartSync={handleStartSync}
          />
        )}

        {phase === 'active' && syncConfig && (
          <YouTubeSyncActive
            syncConfig={syncConfig}
            recentVideos={recentVideos}
            syncHistory={syncHistory}
            isSyncing={isSyncing}
            onSyncNow={syncNow}
            onConfigure={() => setPhase('configure')}
            onResetSync={resetSync}
          />
        )}
      </div>
    </div>
  );
}
