import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useFacebookSync } from "@/hooks/useFacebookSync";
import { useComposio } from "@/hooks/useComposio";
import { FacebookSyncConfig } from "./FacebookSyncConfig";
import { FacebookSyncActive } from "./FacebookSyncActive";
import { SyncingScreen } from "./SyncingScreen";

// Facebook logo component
function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="url(#fb-grad)">
      <defs>
        <linearGradient x1="50%" x2="50%" y1="97.078%" y2="0%" id="fb-grad">
          <stop offset="0%" stopColor="#0062E0"/>
          <stop offset="100%" stopColor="#19AFFF"/>
        </linearGradient>
      </defs>
      <path d="M15 35.8C6.5 34.3 0 26.9 0 18 0 8.1 8.1 0 18 0s18 8.1 18 18c0 8.9-6.5 16.3-15 17.8l-1-.8h-4l-1 .8z"/>
      <path fill="#fff" d="M25 23l.8-5H21v-3.5c0-1.4.5-2.5 2.7-2.5H26V7.4c-1.3-.2-2.7-.4-4-.4-4.1 0-7 2.5-7 7v4h-4.5v5H15v12.7c1 .2 2 .3 3 .3s2-.1 3-.3V23h4z"/>
    </svg>
  );
}

export const FacebookSyncFlow = React.forwardRef<HTMLDivElement>(function FacebookSyncFlow(_props, ref) {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const facebook = useComposio('FACEBOOK');
  
  const {
    phase,
    setPhase,
    syncConfig,
    isSyncing,
    isLoading,
    lastSyncResult,
    loadConfig,
    syncNow,
    resetSync,
  } = useFacebookSync();

  useEffect(() => {
    const checkAuth = async () => {
      await facebook.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (facebook.isConnected) {
      loadConfig();
    } else {
      sessionStorage.setItem('returnAfterFacebookConnect', '/flow/facebook-sync');
      navigate('/integration/facebook');
    }
  }, [facebook.isConnected, isCheckingAuth]);

  const handleBack = () => {
    navigate('/threads');
  };

  const handleStartSync = () => {
    syncNow();
  };

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

  if (phase === 'syncing') {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-[#1877F2] to-[#0062E0]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <FacebookLogo className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Facebook Dump</h1>
              <p className="text-white/70 text-sm truncate">Importing posts...</p>
            </div>
          </div>
        </div>
        <SyncingScreen />
      </div>
    );
  }

  const getSubtitle = () => {
    switch (phase) {
      case 'configure':
        return 'Import your posts as memories';
      case 'active':
        return `${syncConfig?.memoriesCreatedCount || 0} memories created`;
      default:
        return 'Save Facebook posts to memory';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="relative px-5 pt-status-bar pb-6 bg-gradient-to-r from-[#1877F2] to-[#0062E0]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Facebook Dump</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        {phase === 'configure' && (
          <FacebookSyncConfig onStartSync={handleStartSync} />
        )}

        {phase === 'active' && syncConfig && (
          <FacebookSyncActive
            syncConfig={syncConfig}
            isSyncing={isSyncing}
            lastSyncResult={lastSyncResult}
            onSyncNow={syncNow}
            onResetSync={resetSync}
          />
        )}
      </div>
    </div>
  );
});
