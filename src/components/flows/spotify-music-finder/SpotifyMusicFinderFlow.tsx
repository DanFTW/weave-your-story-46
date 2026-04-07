import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useSpotifyMusicFinder } from "@/hooks/useSpotifyMusicFinder";
import { SpotifyMusicFinderConfig } from "./SpotifyMusicFinderConfig";
import { SpotifyMusicFinderActive } from "./SpotifyMusicFinderActive";
import { ActivatingScreen } from "./ActivatingScreen";
import { cn } from "@/lib/utils";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function SpotifyMusicFinderFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const { isConnected, checkStatus, connect, disconnect, connecting } = useComposio("SPOTIFY");

  const {
    phase, setPhase, config, stats, playlists,
    isLoading, isActivating, isLoadingPlaylists, isSyncing, playlistLoadErrorCode,
    loadConfig, loadPlaylists, activate, deactivate, manualPoll,
  } = useSpotifyMusicFinder();

  useEffect(() => {
    const check = async () => {
      setIsCheckingAuth(true);
      await checkStatus();
      setIsCheckingAuth(false);
    };
    check();
  }, [checkStatus]);

  useEffect(() => {
    if (!isCheckingAuth && isConnected) {
      // Connected — clear any stale redirect keys so they don't leak to the integration page
      sessionStorage.removeItem("returnAfterSpotifyConnect");
      sessionStorage.removeItem("spotifyConnectIntent");
      loadConfig();
    } else if (!isCheckingAuth && !isConnected && !connecting && !isReconnecting) {
      // Set intent guard so IntegrationDetail knows this redirect is deliberate
      sessionStorage.setItem("spotifyConnectIntent", "music-finder");
      sessionStorage.setItem("returnAfterSpotifyConnect", "/flow/spotify-music-finder");
      navigate("/integration/spotify");
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate, connecting]);

  const handleBack = () => {
    // Clean up redirect keys when user deliberately leaves
    sessionStorage.removeItem("returnAfterSpotifyConnect");
    sessionStorage.removeItem("spotifyConnectIntent");
    navigate("/threads");
  };

  const handleReconnect = useCallback(async () => {
    setIsReconnecting(true);
    sessionStorage.setItem("spotifyConnectIntent", "music-finder");
    sessionStorage.setItem("returnAfterSpotifyConnect", "/flow/spotify-music-finder");
    await disconnect();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await connect("/flow/spotify-music-finder", true);
    setIsReconnecting(false);
  }, [disconnect, connect]);

  const handleActivate = async (playlistId: string, playlistName: string, frequency: "daily" | "weekly") => {
    setPhase("activating");
    const success = await activate(playlistId, playlistName, frequency);
    if (!success) setPhase("configure");
  };

  if (isCheckingAuth || isLoading || connecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  const needsReconnect = playlistLoadErrorCode === "spotify_reauth_required";

  const getSubtitle = () => {
    if (needsReconnect) return "Connection issue";
    switch (phase) {
      case "configure": return "Set up discovery";
      case "active": return "Discovery active";
      default: return "Music finder";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Spotify Music Finder</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {needsReconnect ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Connection needs refreshing</h2>
              <p className="text-sm text-muted-foreground">
                Your Spotify connection has expired or is missing required permissions. Please reconnect to continue.
              </p>
            </div>
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
            >
              {isReconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Reconnect Spotify
            </button>
          </div>
        ) : (
          <>
            {phase === "configure" && config && (
              <SpotifyMusicFinderConfig
                config={config}
                playlists={playlists}
                isLoadingPlaylists={isLoadingPlaylists}
                onLoadPlaylists={loadPlaylists}
                onActivate={handleActivate}
                isActivating={isActivating}
              />
            )}
            {phase === "active" && (
              <SpotifyMusicFinderActive
                stats={stats}
                onPause={deactivate}
                onManualPoll={manualPoll}
                isSyncing={isSyncing}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
