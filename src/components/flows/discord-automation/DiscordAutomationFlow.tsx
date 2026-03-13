import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiscordAutomation } from "@/hooks/useDiscordAutomation";
import { useComposio } from "@/hooks/useComposio";
import { ServerPicker } from "./ServerPicker";
import { ChannelPicker } from "./ChannelPicker";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";

export function DiscordAutomationFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const discord = useComposio("DISCORD");

  const {
    phase,
    setPhase,
    config,
    servers,
    channels,
    isLoading,
    hasLoadError,
    needsReconnect,
    stats,
    fetchServers,
    reconnectDiscord,
    selectServer,
    selectChannel,
    activateMonitoring,
    deactivateMonitoring,
    resetConfig,
    initializeAfterAuthCheck,
    syncNow,
    isSyncing,
    recentMessages,
    triggerWord,
    triggerWordEnabled,
    updateTriggerWord,
    searchChannel,
  } = useDiscordAutomation();

  // Check Discord connection on mount
  useEffect(() => {
    const checkAuth = async () => {
      await discord.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status after check completes
  useEffect(() => {
    if (isCheckingAuth) return;

    if (discord.isConnected) {
      initializeAfterAuthCheck();
    } else {
      sessionStorage.setItem("returnAfterDiscordConnect", "/flow/discord-tracker");
      navigate("/integration/discord");
    }
  }, [discord.isConnected, isCheckingAuth, navigate, initializeAfterAuthCheck]);

  // Auto-fetch servers when entering select-server phase
  useEffect(() => {
    if (phase === "select-server" && servers.length === 0 && !isLoading && !hasLoadError) {
      fetchServers();
    }
  }, [phase, servers.length, isLoading, hasLoadError, fetchServers]);

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
          <p className="text-muted-foreground text-sm">Checking connection...</p>
        </div>
      </div>
    );
  }

  if (phase === "auth-check" && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
          <p className="text-muted-foreground text-sm">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  if (phase === "active") {
    return (
      <ActiveMonitoring
        stats={stats}
        serverName={config?.serverName || "Unknown Server"}
        channelName={config?.channelName || "Unknown Channel"}
        recentMessages={recentMessages}
        onPause={deactivateMonitoring}
        onReset={resetConfig}
        onSyncNow={syncNow}
        onSearch={searchChannel}
        isLoading={isLoading}
        isSyncing={isSyncing}
        triggerWord={triggerWord}
        triggerWordEnabled={triggerWordEnabled}
        onUpdateTriggerWord={updateTriggerWord}
      />
    );
  }

  const handleBack = () => {
    if (phase === "configure") {
      setPhase("select-channel");
    } else if (phase === "select-channel") {
      setPhase("select-server");
    } else {
      navigate("/threads");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-purple")}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              Discord Message Tracker
            </h1>
            <p className="text-white/70 text-sm truncate">
              {phase === "select-server" && "Select a server"}
              {phase === "select-channel" && "Select a channel to monitor"}
              {phase === "configure" && "Configure monitoring"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === "select-server" && (
          <ServerPicker
            servers={servers}
            isLoading={isLoading}
            hasError={hasLoadError}
            needsReconnect={needsReconnect}
            onSelectServer={selectServer}
            onRefresh={fetchServers}
            onReconnect={reconnectDiscord}
          />
        )}

        {phase === "select-channel" && (
          <ChannelPicker
            channels={channels}
            isLoading={isLoading}
            serverName={config?.serverName || ""}
            needsReconnect={needsReconnect}
            onSelectChannel={selectChannel}
            onReconnect={reconnectDiscord}
            onGoBack={() => setPhase("select-server")}
          />
        )}

        {phase === "configure" && config && (
          <AutomationConfig
            config={config}
            onActivate={activateMonitoring}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
