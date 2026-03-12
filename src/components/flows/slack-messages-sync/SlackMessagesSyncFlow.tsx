import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSlackMessagesSync } from "@/hooks/useSlackMessagesSync";
import { ChannelPicker } from "./ChannelPicker";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { SlackChannel } from "@/types/slackMessagesSync";

export function SlackMessagesSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSlackConnected, setIsSlackConnected] = useState(false);

  const {
    phase,
    setPhase,
    config,
    channels,
    isLoading,
    isPolling,
    stats,
    fetchChannels,
    selectChannel,
    selectedChannelId,
    activate,
    deactivate,
    manualSync,
    manualSearch,
    resetConfig,
    initializeAfterAuthCheck,
  } = useSlackMessagesSync();

  useEffect(() => {
    const checkSlackAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsCheckingAuth(false);
        return;
      }

      const { data } = await supabase
        .from("user_integrations")
        .select("status, composio_connection_id")
        .eq("user_id", user.id)
        .eq("integration_id", "slack")
        .eq("status", "connected")
        .maybeSingle();

      const hasUsableToken = Boolean(data?.composio_connection_id);
      setIsSlackConnected(hasUsableToken);
      setIsCheckingAuth(false);
    };
    checkSlackAuth();
  }, []);

  useEffect(() => {
    if (isCheckingAuth) return;

    if (isSlackConnected) {
      initializeAfterAuthCheck();
    } else {
      sessionStorage.setItem("returnAfterSlackConnect", "/flow/slack-messages-sync");
      navigate("/integration/slack");
    }
  }, [isSlackConnected, isCheckingAuth, navigate, initializeAfterAuthCheck]);

  // Trigger activate after channel selection
  useEffect(() => {
    if (selectedChannelId && phase === "select-channels") {
      activate();
    }
  }, [selectedChannelId]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4A154B]" />
          <p className="text-muted-foreground text-sm">Checking connection...</p>
        </div>
      </div>
    );
  }

  if (phase === "auth-check" && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4A154B]" />
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
        onPause={deactivate}
        onSyncNow={manualSync}
        onSearch={manualSearch}
        onReset={resetConfig}
        isLoading={isLoading}
        isPolling={isPolling}
      />
    );
  }

  const handleChannelSelected = (channel: SlackChannel) => {
    selectChannel(channel.id, channel.name);
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-purple")}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/threads")}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              Slack Channel Monitor
            </h1>
            <p className="text-white/70 text-sm truncate">
              Select a channel to monitor
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        {phase === "select-channels" && (
          <ChannelPicker
            channels={channels}
            isLoading={isLoading}
            onSelectChannel={handleChannelSelected}
            onRefresh={fetchChannels}
          />
        )}
      </div>
    </div>
  );
}
