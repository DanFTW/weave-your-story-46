import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
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

  const { isConnected, checkStatus } = useComposio("SPOTIFY");

  const {
    phase, setPhase, config, stats, playlists,
    isLoading, isActivating, isLoadingPlaylists, isSyncing,
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
      loadConfig();
    } else if (!isCheckingAuth && !isConnected) {
      sessionStorage.setItem("returnAfterSpotifyConnect", "/flow/spotify-music-finder");
      navigate("/integration/spotify");
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate]);

  const handleBack = () => navigate("/threads");

  const handleActivate = async (playlistId: string, playlistName: string, frequency: "daily" | "weekly") => {
    setPhase("activating");
    const success = await activate(playlistId, playlistName, frequency);
    if (!success) setPhase("configure");
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  const getSubtitle = () => {
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
      </div>
    </div>
  );
}
