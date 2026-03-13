import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SlackMessagesSyncPhase,
  SlackChannel,
  SlackWorkspace,
  SlackMessagesSyncConfig,
  SlackMessagesSyncStats,
  SlackRecentMessage,
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
  fetchChannels: (teamId?: string) => Promise<void>;
  fetchWorkspace: () => Promise<void>;
  selectWorkspace: (workspace: SlackWorkspace) => void;
  selectChannels: (channels: SlackChannel[]) => void;
  selectedChannelIds: string[];
  selectedChannelNames: string[];
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  manualSync: () => Promise<void>;
  manualSearch: (query: string) => Promise<void>;
  resetConfig: () => Promise<void>;
  initializeAfterAuthCheck: () => Promise<void>;
  workspaceError: boolean;
  recentMessages: SlackRecentMessage[];
  fetchRecentMessages: () => Promise<void>;
}

export function useSlackMessagesSync(): UseSlackMessagesSyncReturn {
  const { toast } = useToast();

  const [phase, setPhase] = useState<SlackMessagesSyncPhase>("auth-check");
  const [config, setConfig] = useState<SlackMessagesSyncConfig | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [workspace, setWorkspace] = useState<SlackWorkspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState(false);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedChannelNames, setSelectedChannelNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [recentMessages, setRecentMessages] = useState<SlackRecentMessage[]>([]);

  const stats: SlackMessagesSyncStats = {
    messagesImported: config?.messagesImported ?? 0,
    lastPolled: config?.lastPolledAt ?? null,
    isActive: config?.isActive ?? false,
    channelNames: config?.selectedChannelNames ?? selectedChannelNames,
  };

  const fetchWorkspace = useCallback(async () => {
    setIsLoading(true);
    setWorkspaceError(false);
    try {
      const { data, error } = await supabase.functions.invoke("slack-messages-sync", { body: { action: "list-workspace" } });
      if (error) throw error;
      if (data.error) {
        if (data.error === "Slack not connected" || data.needsReconnect) { setPhase("needs-reconnect"); return; }
        setWorkspaceError(true);
        toast({ title: "Failed to load workspace", description: data.error, variant: "destructive" });
        return;
      }
      setWorkspace(data.workspace || null);
    } catch (error: any) {
      console.error("Failed to fetch workspace:", error);
      setWorkspaceError(true);
      toast({ title: "Failed to fetch workspace", description: "Could not load your Slack workspace. Please try again.", variant: "destructive" });
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
      const channelIds: string[] = c.selected_channel_ids ?? [];
      const channelNames: string[] = c.selected_workspace_ids ?? [];
      setConfig({
        id: c.id,
        userId: c.user_id,
        isActive: c.is_active ?? false,
        selectedChannelIds: channelIds,
        selectedChannelNames: channelNames,
        messagesImported: c.messages_imported ?? 0,
        lastPolledAt: c.last_polled_at,
      });
      setSelectedChannelIds(channelIds);
      setSelectedChannelNames(channelNames);

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

  const fetchChannels = useCallback(async (teamId?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-messages-sync", { body: { action: "list-channels", ...(teamId && { teamId }) } });
      if (error) throw error;
      if (data.error) {
        if (data.error === "Slack not connected" || data.needsReconnect) { setPhase("needs-reconnect"); return; }
        toast({ title: "Failed to load channels", description: data.error, variant: "destructive" });
        setChannels([]);
        return;
      }
      setChannels(data.channels || []);
    } catch (error: any) {
      let errorBody = "";
      if (error?.context && typeof error.context.text === "function") {
        try { errorBody = await error.context.text(); } catch { errorBody = ""; }
      }
      if (errorBody.includes("Slack not connected")) { setPhase("needs-reconnect"); return; }
      console.error("Failed to fetch channels:", error);
      toast({ title: "Failed to fetch channels", description: "Could not load your Slack channels. Please try again.", variant: "destructive" });
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const selectChannels = useCallback((selected: SlackChannel[]) => {
    setSelectedChannelIds(selected.map((c) => c.id));
    setSelectedChannelNames(selected.map((c) => c.name));
  }, []);

  const activate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || selectedChannelIds.length === 0) return;

    setPhase("activating");
    try {
      const { error } = await supabase
        .from("slack_messages_config" as any)
        .upsert(
          {
            user_id: user.id,
            is_active: true,
            search_mode: false,
            selected_channel_ids: selectedChannelIds,
            selected_workspace_ids: selectedChannelNames,
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke("slack-messages-sync", { body: { action: "activate" } });
      if (fnError) throw fnError;

      setConfig(prev => prev
        ? { ...prev, isActive: true, selectedChannelIds, selectedChannelNames }
        : {
            id: "",
            userId: user.id,
            isActive: true,
            selectedChannelIds,
            selectedChannelNames,
            messagesImported: 0,
            lastPolledAt: null,
          }
      );

      setPhase("active");
      const label = selectedChannelNames.map(n => `#${n}`).join(", ");
      toast({ title: "Message monitor activated", description: `Now monitoring ${label}.` });
    } catch (error) {
      console.error("Failed to activate:", error);
      setPhase("select-channels");
      toast({ title: "Activation failed", description: "Could not start message monitor. Please try again.", variant: "destructive" });
    }
  }, [selectedChannelIds, selectedChannelNames, toast]);

  const deactivate = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("slack_messages_config" as any).update({ is_active: false }).eq("user_id", user.id);
      if (error) throw error;
      setConfig(prev => prev ? { ...prev, isActive: false } : null);
      setPhase("select-channels");
      toast({ title: "Monitor paused", description: "Slack message monitoring has been paused." });
    } catch (error) {
      console.error("Failed to deactivate:", error);
      toast({ title: "Deactivation failed", description: "Could not pause monitor. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchRecentMessages = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("slack_processed_messages" as any)
        .select("id, slack_message_id, message_content, author_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) { console.error("Failed to fetch recent messages:", error); return; }
      setRecentMessages(
        (data || []).map((m: any) => ({
          id: m.id,
          slackMessageId: m.slack_message_id,
          messageContent: m.message_content,
          authorName: m.author_name,
          createdAt: m.created_at,
        }))
      );
    } catch (err) {
      console.error("fetchRecentMessages error:", err);
    }
  }, []);

  const manualSync = useCallback(async () => {
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-messages-sync", { body: { action: "poll" } });
      if (error) throw error;
      if (data.messagesImported !== undefined) {
        setConfig(prev => prev
          ? { ...prev, messagesImported: prev.messagesImported + (data.messagesImported || 0), lastPolledAt: new Date().toISOString() }
          : null
        );
      }
      const imported = data.messagesImported || 0;
      const backfilled = data.backfilled || 0;
      const description = imported > 0
        ? `Imported ${imported} new messages.`
        : backfilled > 0
          ? `Updated ${backfilled} existing messages.`
          : "No new messages found.";
      toast({ title: "Sync complete", description });
    } catch (error) {
      console.error("Manual sync failed:", error);
      toast({ title: "Sync failed", description: "Could not complete sync. Please try again.", variant: "destructive" });
    } finally {
      setIsPolling(false);
      fetchRecentMessages();
    }
  }, [toast, fetchRecentMessages]);

  const manualSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsPolling(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-messages-sync", { body: { action: "search", query } });
      if (error) throw error;
      if (data.messagesImported !== undefined) {
        setConfig(prev => prev
          ? { ...prev, messagesImported: prev.messagesImported + (data.messagesImported || 0) }
          : null
        );
      }
      toast({
        title: "Search complete",
        description: data.messagesImported ? `Imported ${data.messagesImported} matching messages.` : "No new matching messages found.",
      });
    } catch (error) {
      console.error("Search failed:", error);
      toast({ title: "Search failed", description: "Could not complete search. Please try again.", variant: "destructive" });
    } finally {
      setIsPolling(false);
      fetchRecentMessages();
    }
  }, [toast, fetchRecentMessages]);

  const resetConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("slack_messages_config" as any).delete().eq("user_id", user.id);
      if (error) throw error;
      setConfig(null);
      setChannels([]);
      setWorkspace(null);
      setSelectedChannelIds([]);
      setSelectedChannelNames([]);
      setHasInitialized(false);
      setPhase("select-workspace");
    } catch (error) {
      console.error("Failed to reset:", error);
      toast({ title: "Reset failed", description: "Could not reset configuration.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    phase, setPhase, config, channels, workspace,
    isLoading, isPolling, stats,
    fetchChannels, fetchWorkspace, selectWorkspace,
    selectChannels, selectedChannelIds, selectedChannelNames,
    activate, deactivate, manualSync, manualSearch,
    resetConfig, initializeAfterAuthCheck, workspaceError,
    recentMessages, fetchRecentMessages,
  };
}
