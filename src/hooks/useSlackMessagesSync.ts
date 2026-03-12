import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SlackMessagesSyncPhase,
  SlackChannel,
  SlackMessagesSyncConfig,
  SlackMessagesSyncStats,
} from "@/types/slackMessagesSync";

interface UseSlackMessagesSyncReturn {
  phase: SlackMessagesSyncPhase;
  setPhase: (phase: SlackMessagesSyncPhase) => void;
  config: SlackMessagesSyncConfig | null;
  channels: SlackChannel[];
  isLoading: boolean;
  isPolling: boolean;
  stats: SlackMessagesSyncStats;
  fetchChannels: () => Promise<void>;
  toggleChannel: (channelId: string) => void;
  selectAllChannels: () => void;
  deselectAllChannels: () => void;
  selectedChannelIds: string[];
  searchMode: boolean;
  setSearchMode: (on: boolean) => void;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  manualSync: () => Promise<void>;
  resetConfig: () => Promise<void>;
  initializeAfterAuthCheck: () => Promise<void>;
}

export function useSlackMessagesSync(): UseSlackMessagesSyncReturn {
  const { toast } = useToast();

  const [phase, setPhase] = useState<SlackMessagesSyncPhase>("auth-check");
  const [config, setConfig] = useState<SlackMessagesSyncConfig | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [searchMode, setSearchMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const stats: SlackMessagesSyncStats = {
    messagesImported: config?.messagesImported ?? 0,
    lastPolled: config?.lastPolledAt ?? null,
    isActive: config?.isActive ?? false,
    searchMode: config?.searchMode ?? false,
  };

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
      setConfig({
        id: c.id,
        userId: c.user_id,
        isActive: c.is_active ?? false,
        searchMode: c.search_mode ?? false,
        selectedChannelIds: c.selected_channel_ids ?? [],
        messagesImported: c.messages_imported ?? 0,
        lastPolledAt: c.last_polled_at,
      });
      setSelectedChannelIds(c.selected_channel_ids ?? []);
      setSearchMode(c.search_mode ?? false);

      if (c.is_active) {
        setPhase("active");
      } else if (c.selected_channel_ids?.length > 0) {
        setPhase("configure");
      } else {
        setPhase("select-channels");
      }
    } else {
      setPhase("select-channels");
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
        toast({
          title: "Failed to load channels",
          description: data.error,
          variant: "destructive",
        });
        setChannels([]);
        return;
      }
      const fetchedChannels = data.channels || [];
      setChannels(fetchedChannels);
      // Default: select all channels if none previously selected
      if (selectedChannelIds.length === 0) {
        setSelectedChannelIds(fetchedChannels.map((c: SlackChannel) => c.id));
      }
    } catch (error) {
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
  }, [toast, selectedChannelIds.length]);

  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannelIds(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  }, []);

  const selectAllChannels = useCallback(() => {
    setSelectedChannelIds(channels.map(c => c.id));
  }, [channels]);

  const deselectAllChannels = useCallback(() => {
    setSelectedChannelIds([]);
  }, []);

  const activate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setPhase("activating");
    try {
      // Upsert config
      const { error } = await supabase
        .from("slack_messages_config" as any)
        .upsert(
          {
            user_id: user.id,
            is_active: true,
            search_mode: searchMode,
            selected_channel_ids: selectedChannelIds,
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      // Invoke edge function to activate
      const { data, error: fnError } = await supabase.functions.invoke(
        "slack-messages-sync",
        { body: { action: "activate" } }
      );
      if (fnError) throw fnError;

      setConfig(prev => prev
        ? { ...prev, isActive: true, searchMode, selectedChannelIds }
        : {
            id: "",
            userId: user.id,
            isActive: true,
            searchMode,
            selectedChannelIds,
            messagesImported: 0,
            lastPolledAt: null,
          }
      );

      setPhase("active");
      toast({
        title: "Slack sync activated",
        description: "Your Slack messages will now be imported as memories.",
      });
    } catch (error) {
      console.error("Failed to activate:", error);
      setPhase("configure");
      toast({
        title: "Activation failed",
        description: "Could not start Slack sync. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchMode, selectedChannelIds, toast]);

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
      setPhase("configure");
      toast({
        title: "Sync paused",
        description: "Slack message sync has been paused.",
      });
    } catch (error) {
      console.error("Failed to deactivate:", error);
      toast({
        title: "Deactivation failed",
        description: "Could not pause sync. Please try again.",
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

  const resetConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      await supabase
        .from("slack_messages_config" as any)
        .delete()
        .eq("user_id", user.id);

      setConfig(null);
      setChannels([]);
      setSelectedChannelIds([]);
      setSearchMode(false);
      setPhase("select-channels");
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
    isLoading,
    isPolling,
    stats,
    fetchChannels,
    toggleChannel,
    selectAllChannels,
    deselectAllChannels,
    selectedChannelIds,
    searchMode,
    setSearchMode,
    activate,
    deactivate,
    manualSync,
    resetConfig,
    initializeAfterAuthCheck,
  };
}
