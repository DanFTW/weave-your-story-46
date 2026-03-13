import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSlackMessagesSync } from "@/hooks/useSlackMessagesSync";
import { ChannelPicker } from "./ChannelPicker";
import { WorkspacePicker } from "./WorkspacePicker";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { SlackChannel, SlackWorkspace } from "@/types/slackMessagesSync";

export function SlackMessagesSyncFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSlackConnected, setIsSlackConnected] = useState(false);

  const {
    phase, setPhase, config, channels, workspace,
    isLoading, isPolling, stats,
    fetchChannels, fetchWorkspace, selectWorkspace,
    selectChannels, selectedChannelIds,
    activate, deactivate, manualSync, manualSearch,
    resetConfig, initializeAfterAuthCheck, workspaceError,
    recentMessages, fetchRecentMessages,
  } = useSlackMessagesSync();

  const [shouldActivate, setShouldActivate] = useState(false);

  useEffect(() => {
    const checkSlackAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setIsCheckingAuth(false); return; }
        const { data } = await supabase
          .from("user_integrations")
          .select("status")
          .eq("user_id", session.user.id)
          .eq("integration_id", "slack")
          .eq("status", "connected")
          .maybeSingle();
        setIsSlackConnected(Boolean(data));
      } catch (err) {
        console.error("Slack auth check failed:", err);
      } finally {
        setIsCheckingAuth(false);
      }
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

  useEffect(() => {
    if (phase === "select-workspace" && !workspace && !isLoading) {
      fetchWorkspace();
    }
  }, [phase, workspace, isLoading, fetchWorkspace]);

  // Trigger activate after channels confirmed
  useEffect(() => {
    if (shouldActivate && selectedChannelIds.length > 0 && phase === "select-channels") {
      setShouldActivate(false);
      activate();
    }
  }, [shouldActivate, selectedChannelIds, phase, activate]);

  useEffect(() => {
    if (phase === "active") {
      fetchRecentMessages();
    }
  }, [phase, fetchRecentMessages]);

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

  if (phase === "needs-reconnect") {
    const handleReconnect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("user_integrations").delete().eq("user_id", session.user.id).eq("integration_id", "slack");
      }
      sessionStorage.setItem("returnAfterSlackConnect", "/flow/slack-messages-sync");
      navigate("/integration/slack");
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Reconnect Slack</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your Slack connection needs to be refreshed.
          </p>
          <button onClick={handleReconnect} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#4A154B] text-white font-semibold text-sm hover:bg-[#3a1040] transition-colors">
            <RefreshCw className="w-4 h-4" />
            Reconnect Slack
          </button>
          <button onClick={() => navigate("/threads")} className="text-muted-foreground text-sm underline underline-offset-2">Go back</button>
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
        recentMessages={recentMessages}
        onPause={deactivate}
        onSyncNow={manualSync}
        onSearch={manualSearch}
        onReset={resetConfig}
        isLoading={isLoading}
        isPolling={isPolling}
      />
    );
  }

  const handleWorkspaceSelected = (ws: SlackWorkspace) => {
    selectWorkspace(ws);
    fetchChannels(ws.id);
  };

  const handleChannelsConfirmed = (selected: SlackChannel[]) => {
    selectChannels(selected);
    setShouldActivate(true);
  };

  const handleBack = () => {
    if (phase === "select-channels") {
      setPhase("select-workspace");
    } else {
      navigate("/threads");
    }
  };

  const headerSubtitle = phase === "select-workspace"
    ? "Select a workspace"
    : "Select channels to monitor";

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-purple")}>
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Slack Message Monitor</h1>
            <p className="text-white/70 text-sm truncate">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5">
        {phase === "select-workspace" && (
          <WorkspacePicker
            workspace={workspace}
            isLoading={isLoading}
            hasError={workspaceError}
            onSelectWorkspace={handleWorkspaceSelected}
            onRefresh={fetchWorkspace}
          />
        )}

        {phase === "select-channels" && (
          <ChannelPicker
            channels={channels}
            isLoading={isLoading}
            onConfirmChannels={handleChannelsConfirmed}
            onRefresh={fetchChannels}
          />
        )}
      </div>
    </div>
  );
}
