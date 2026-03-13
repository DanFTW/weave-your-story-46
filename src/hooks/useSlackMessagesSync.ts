import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SlackMessagesSyncPhase,
  SlackChannel,
  SlackWorkspace,
  SlackMessagesSyncConfig,
  SlackMessagesSyncStats,
} from "@/types/slackMessagesSync";

interface UseSlackMessagesSyncReturn {
  phase: SlackMessagesSyncPhase;
  setPhase: (phase: SlackMessagesSyncPhase) => void;
  config: SlackMessagesSyncConfig | null;
  channels: SlackChannel[];
  workspace: SlackWorkspace | null;
  isLoading: boolean;
  isPolling: boolean;
  stats: SlackMessagesSyncStats;
  fetchChannels: () => Promise<void>;
  fetchWorkspace: () => Promise<void>;
  selectWorkspace: (workspace: SlackWorkspace) => void;
  selectChannel: (channelId: string, channelName: string) => void;
  selectedChannelId: string | null;
  selectedChannelName: string | null;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  manualSync: () => Promise<void>;
  manualSearch: (query: string) => Promise<void>;
  resetConfig: () => Promise<void>;
  initializeAfterAuthCheck: () => Promise<void>;
  workspaceError: boolean;
}

export function useSlackMessagesSync(): UseSlackMessagesSyncReturn {
  const { toast } = useToast();

  const [phase, setPhase] = useState<SlackMessagesSyncPhase>("auth-check");
  const [config, setConfig] = useState<SlackMessagesSyncConfig | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [workspace, setWorkspace] = useState<SlackWorkspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedChannelName, setSelectedChannelName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const stats: SlackMessagesSyncStats = {
    messagesImported: config?.messagesImported ?? 0,
    lastPolled: config?.lastPolledAt ?? null,
    isActive: config?.isActive ?? false,
    channelName: config?.selectedChannelName ?? selectedChannelName,
  };

  const fetchWorkspace = useCallback(async () => {
    setIsLoading(true);
    setWorkspaceError(false);
    try {
      const { data, error } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "list-workspace" } }
      );
      if (error) throw error;
      if (data.error) {
        if (data.error === "Slack not connected" || data.needsReconnect) {
          setPhase("needs-reconnect");
          return;
        }
        setWorkspaceError(true);
        toast({
          title: "Failed to load workspace",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      setWorkspace(data.workspace || null);
    } catch (error: any) {
      console.error("Failed to fetch workspace:", error);
      setWorkspaceError(true);
      toast({
        title: "Failed to fetch workspace",
        description: "Could not load your Slack workspace. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const selectWorkspace = useCallback((_workspace: SlackWorkspace) => {
    setPhase("select-channels");
  }, []);

  const loadConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingConfig } = await supabase
      .from("slack_messages_config" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingConfig) {
      const c = existingConfig as any;
      const channelIds = c.selected_channel_ids ?? [];
      setConfig({
        id: c.id,
        userId: c.user_id,
        isActive: c.is_active ?? false,
        selectedChannelId: channelIds[0] ?? null,
        selectedChannelName: c.selected_workspace_ids?.[0] ?? null,
        messagesImported: c.messages_imported ?? 0,
        lastPolledAt: c.last_polled_at,
      });
      setSelectedChannelId(channelIds[0] ?? null);
      setSelectedChannelName(c.selected_workspace_ids?.[0] ?? null);

      if (c.is_active) {
        setPhase("active");
      } else {
        setPhase("select-workspace");
      }
    } else {
      setPhase("select-workspace");
    }
  }, []);

  const initializeAfterAuthCheck = useCallback(async () => {
    if (hasInitialized) return;
    setHasInitialized(true);
    setIsLoading(true);
    await loadConfig();
    setIsLoading(false);
  }, [hasInitialized, loadConfig]);

  const fetchChannels = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "list-channels" } }
      );
      if (error) throw error;
      if (data.error) {
        if (data.error === "Slack not connected" || data.needsReconnect) {
          setPhase("needs-reconnect");
          return;
        }
        toast({
          title: "Failed to load channels",
          description: data.error,
          variant: "destructive",
        });
        setChannels([]);
        return;
      }
      setChannels(data.channels || []);
    } catch (error: any) {
      let errorBody = "";
      if (error?.context && typeof error.context.text === "function") {
        try {
          errorBody = await error.context.text();
        } catch {
          errorBody = "";
        }
      }

      if (errorBody.includes("Slack not connected")) {
        setPhase("needs-reconnect");
        return;
      }

      console.error("Failed to fetch channels:", error);
      toast({
        title: "Failed to fetch channels",
        description: "Could not load your Slack channels. Please try again.",
        variant: "destructive",
      });
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const selectChannel = useCallback((channelId: string, channelName: string) => {
    setSelectedChannelId(channelId);
    setSelectedChannelName(channelName);
  }, []);

  const activate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !selectedChannelId) return;

    setPhase("activating");
    try {
      const { error } = await supabase
        .from("slack_messages_config" as any)
        .upsert(
          {
            user_id: user.id,
            is_active: true,
            search_mode: false,
            selected_channel_ids: [selectedChannelId],
            selected_workspace_ids: [selectedChannelName],
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "activate" } }
      );
      if (fnError) throw fnError;

      setConfig(prev => prev
        ? { ...prev, isActive: true, selectedChannelId, selectedChannelName }
        : {
            id: "",
            userId: user.id,
            isActive: true,
            selectedChannelId,
            selectedChannelName,
            messagesImported: 0,
            lastPolledAt: null,
          }
      );

      setPhase("active");
      toast({
        title: "Channel monitor activated",
        description: `Now monitoring #${selectedChannelName || "channel"}.`,
      });
    } catch (error) {
      console.error("Failed to activate:", error);
      setPhase("select-channels");
      toast({
        title: "Activation failed",
        description: "Could not start channel monitor. Please try again.",
        variant: "destructive",
      });
    }
  }, [selectedChannelId, selectedChannelName, toast]);

  const deactivate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("slack_messages_config" as any)
        .update({ is_active: false })
        .eq("user_id", user.id);

      if (error) throw error;

      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase("select-channels");
      toast({
        title: "Monitor paused",
        description: "Slack channel monitoring has been paused.",
      });
    } catch (error) {
      console.error("Failed to deactivate:", error);
      toast({
        title: "Deactivation failed",
        description: "Could not pause monitor. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const manualSync = useCallback(async () => {
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "poll" } }
      );
      if (error) throw error;

      if (data.messagesImported !== undefined) {
        setConfig(prev => prev
          ? { ...prev, messagesImported: prev.messagesImported + (data.messagesImported || 0), lastPolledAt: new Date().toISOString() }
          : null
        );
      }

      toast({
        title: "Sync complete",
        description: data.messagesImported
          ? `Imported ${data.messagesImported} new messages.`
          : "No new messages found.",
      });
    } catch (error) {
      console.error("Manual sync failed:", error);
      toast({
        title: "Sync failed",
        description: "Could not complete sync. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPolling(false);
    }
  }, [toast]);

  const manualSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "search", query } }
      );
      if (error) throw error;

      if (data.messagesImported !== undefined) {
        setConfig(prev => prev
          ? { ...prev, messagesImported: prev.messagesImported + (data.messagesImported || 0) }
          : null
        );
      }

      toast({
        title: "Search complete",
        description: data.messagesImported
          ? `Imported ${data.messagesImported} matching messages.`
          : "No new matching messages found.",
      });
    } catch (error) {
      console.error("Search failed:", error);
      toast({
        title: "Search failed",
        description: "Could not complete search. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPolling(false);
    }
  }, [toast]);

  const resetConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("slack_messages_config" as any)
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setConfig(null);
      setChannels([]);
      setWorkspace(null);
      setSelectedChannelId(null);
      setSelectedChannelName(null);
      setHasInitialized(false);
      setPhase("select-workspace");
    } catch (error) {
      console.error("Failed to reset:", error);
      toast({
        title: "Reset failed",
        description: "Could not reset configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    phase,
    setPhase,
    config,
    channels,
    workspace,
    isLoading,
    isPolling,
    stats,
    fetchChannels,
    fetchWorkspace,
    selectWorkspace,
    selectChannel,
    selectedChannelId,
    selectedChannelName,
    activate,
    deactivate,
    manualSync,
    manualSearch,
    resetConfig,
    initializeAfterAuthCheck,
    workspaceError,
  };
}
