import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTwitterSync } from "@/hooks/useTwitterSync";
import { useComposio } from "@/hooks/useComposio";
import { TwitterSyncConfig } from "./TwitterSyncConfig";
import { TwitterSyncActive } from "./TwitterSyncActive";
import { SyncingScreen } from "./SyncingScreen";

// X logo component
function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function TwitterSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const twitter = useComposio('TWITTER');
  
  const {
    phase,
    setPhase,
    syncConfig,
    recentTweets,
    isSyncing,
    isLoading,
    isSavingConfig,
    loadConfig,
    saveConfig,
    syncNow,
    fetchRecentTweets,
    resetSync,
  } = useTwitterSync();

  // Check Twitter connection status
  useEffect(() => {
    const checkAuth = async () => {
      await twitter.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (twitter.isConnected) {
      loadConfig();
      fetchRecentTweets();
    } else {
      sessionStorage.setItem('returnAfterTwitterConnect', '/flow/twitter-sync');
      navigate('/integration/twitter');
    }
  }, [twitter.isConnected, isCheckingAuth]);

  const handleBack = () => {
    navigate('/threads');
  };

  const handleSaveConfig = async (config: { 
    syncTweets: boolean; 
    syncRetweets: boolean;
    syncReplies: boolean;
    syncLikes: boolean;
  }) => {
    await saveConfig({
      syncTweets: config.syncTweets,
      syncRetweets: config.syncRetweets,
      syncReplies: config.syncReplies,
      syncLikes: config.syncLikes,
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
        <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-gray-900 to-black">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <XLogo className="w-6 h-6 text-white" />
            </div>
            
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Twitter Dump</h1>
              <p className="text-white/70 text-sm truncate">Dumping tweets...</p>
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
        return 'Sync tweets to memory';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-gray-900 to-black">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Twitter Dump</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'configure' && (
          <TwitterSyncConfig
            syncTweets={syncConfig?.syncTweets ?? true}
            syncRetweets={syncConfig?.syncRetweets ?? true}
            syncReplies={syncConfig?.syncReplies ?? true}
            syncLikes={syncConfig?.syncLikes ?? true}
            isSaving={isSavingConfig}
            onSave={handleSaveConfig}
            onStartSync={handleStartSync}
          />
        )}

        {phase === 'active' && syncConfig && (
          <TwitterSyncActive
            syncConfig={syncConfig}
            recentTweets={recentTweets}
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
