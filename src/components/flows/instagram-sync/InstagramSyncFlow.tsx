import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Instagram, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstagramSync } from "@/hooks/useInstagramSync";
import { useComposio } from "@/hooks/useComposio";
import { InstagramSyncConfig } from "./InstagramSyncConfig";
import { InstagramSyncActive } from "./InstagramSyncActive";
import { SyncingScreen } from "./SyncingScreen";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function InstagramSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const instagram = useComposio('INSTAGRAM');
  
  const {
    phase,
    setPhase,
    syncConfig,
    recentPosts,
    isSyncing,
    isLoading,
    isSavingConfig,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentPosts,
    resetSync,
  } = useInstagramSync();

  // Check Instagram connection status
  useEffect(() => {
    const checkAuth = async () => {
      await instagram.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (instagram.isConnected) {
      loadConfig();
      fetchRecentPosts();
    } else {
      navigate('/integration/instagram');
    }
  }, [instagram.isConnected, isCheckingAuth]);

  const handleBack = () => {
    navigate('/threads');
  };

  const handleSaveConfig = async (config: { 
    syncPosts: boolean; 
    syncComments: boolean;
    syncStories: boolean;
  }) => {
    await saveConfig({
      syncPosts: config.syncPosts,
      syncComments: config.syncComments,
      syncStories: config.syncStories,
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
        <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.pink)}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Instagram className="w-6 h-6 text-white" />
            </div>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Instagram Dump</h1>
              <p className="text-white/70 text-sm truncate">Dumping posts...</p>
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
        return 'Sync posts to memory';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.pink)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Instagram Dump</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'configure' && (
          <InstagramSyncConfig
            syncPosts={syncConfig?.syncPosts ?? true}
            syncComments={syncConfig?.syncComments ?? true}
            isSaving={isSavingConfig}
            onSave={handleSaveConfig}
            onStartSync={handleStartSync}
          />
        )}

        {phase === 'active' && syncConfig && (
          <InstagramSyncActive
            syncConfig={syncConfig}
            recentPosts={recentPosts}
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
