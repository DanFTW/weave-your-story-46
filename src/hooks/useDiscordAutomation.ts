import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DiscordAutomationPhase,
  DiscordServer,
  DiscordChannel,
  DiscordAutomationConfig,
  DiscordAutomationStats,
  DiscordRecentMessage,
} from "@/types/discordAutomation";

interface UseDiscordAutomationReturn {
  phase: DiscordAutomationPhase;
  setPhase: (phase: DiscordAutomationPhase) => void;
  config: DiscordAutomationConfig | null;
  servers: DiscordServer[];
  channels: DiscordChannel[];
  isLoading: boolean;
  hasLoadError: boolean;
  needsReconnect: boolean;
  stats: DiscordAutomationStats;
  fetchServers: () => Promise<void>;
  reconnectDiscord: () => Promise<void>;
  selectServer: (server: DiscordServer) => Promise<void>;
  selectChannel: (channel: DiscordChannel) => Promise<void>;
  activateMonitoring: () => Promise<void>;
  deactivateMonitoring: () => Promise<void>;
  resetConfig: () => Promise<void>;
  initializeAfterAuthCheck: () => Promise<void>;
  syncNow: () => Promise<void>;
  isSyncing: boolean;
  recentMessages: DiscordRecentMessage[];
  triggerWord: string;
  triggerWordEnabled: boolean;
  updateTriggerWord: (word: string, enabled: boolean) => Promise<void>;
  searchChannel: (query: string) => Promise<void>;
}

export function useDiscordAutomation(): UseDiscordAutomationReturn {
  const { toast } = useToast();

  const [phase, setPhase] = useState<DiscordAutomationPhase>("auth-check");
  const [config, setConfig] = useState<DiscordAutomationConfig | null>(null);
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [recentMessages, setRecentMessages] = useState<DiscordRecentMessage[]>([]);
  const [triggerWord, setTriggerWord] = useState("");
  const [triggerWordEnabled, setTriggerWordEnabled] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const stats: DiscordAutomationStats = {
    messagesTracked: messageCount,
    lastChecked: config?.lastCheckedAt ?? null,
    isActive: config?.isActive ?? false,
  };

  const loadMessageCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { count } = await supabase
      .from("discord_processed_messages" as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    setMessageCount(count ?? 0);
  }, []);

  const loadRecentMessages = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("discord_processed_messages" as any)
      .select("*")
      .eq("user_id", user.id)
      .not("message_content", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setRecentMessages(
        (data as any[]).map((r) => ({
          id: r.id,
          discordMessageId: r.discord_message_id,
          messageContent: r.message_content,
          authorName: r.author_name,
          createdAt: r.created_at,
        }))
      );
    }
  }, []);

  const loadConfig = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingConfig } = await supabase
      .from("discord_automation_config" as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingConfig) {
      const c = existingConfig as any;
      setConfig({
        id: c.id,
        userId: c.user_id,
        serverId: c.server_id,
        serverName: c.server_name,
        channelId: c.channel_id,
        channelName: c.channel_name,
        isActive: c.is_active ?? false,
        triggerInstanceId: c.trigger_instance_id,
        connectedAccountId: c.connected_account_id,
        messagesTracked: c.messages_tracked ?? 0,
        lastCheckedAt: c.last_checked_at,
        triggerWord: c.trigger_word || "",
        triggerWordEnabled: c.trigger_word_enabled ?? false,
      });
      setTriggerWord(c.trigger_word || "");
      setTriggerWordEnabled(c.trigger_word_enabled ?? false);

      if (c.is_active) {
        setPhase("active");
        // Load recent messages and true count when active
        await loadRecentMessages();
        await loadMessageCount();
      } else if (c.channel_id) {
        setPhase("configure");
      } else if (c.server_id) {
        setPhase("select-channel");
      } else {
        setPhase("select-server");
      }
    } else {
      setPhase("select-server");
    }
  }, [loadRecentMessages, loadMessageCount]);

  const initializeAfterAuthCheck = useCallback(async () => {
    if (hasInitialized) return;
    setHasInitialized(true);
    setIsLoading(true);
    await loadConfig();
    setIsLoading(false);
  }, [hasInitialized, loadConfig]);

  const extractErrorMessage = (data: any): string => {
    if (data.details) {
      if (typeof data.details === "string") return data.details;
      if (data.details.message) return data.details.message;
      if (data.details.suggested_fix) return data.details.suggested_fix;
    }
    return data.error || "Unknown error";
  };

  const fetchServers = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);
    setNeedsReconnect(false);
    try {
      const { data, error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        { body: { action: "get-servers" } }
      );
      if (error) throw error;
      if (data.error) {
        const isAuthFailure = data.requiresReconnect === true;
        if (isAuthFailure) {
          setNeedsReconnect(true);
        }
        toast({
          title: "Failed to load servers",
          description: extractErrorMessage(data),
          variant: "destructive",
        });
        setServers([]);
        setHasLoadError(true);
        return;
      }
      setServers(data.servers || []);
    } catch (error) {
      console.error("Failed to fetch servers:", error);
      toast({
        title: "Failed to fetch servers",
        description: "Could not load your Discord servers. Please try again.",
        variant: "destructive",
      });
      setServers([]);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const reconnectDiscord = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        { body: { action: "reconnect" } }
      );
      if (error) throw error;
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast({
          title: "Reconnection failed",
          description: data.error || "Could not get Discord authorization URL.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to reconnect Discord:", error);
      toast({
        title: "Reconnection failed",
        description: "Could not initiate Discord reconnection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const selectServer = useCallback(
    async (server: DiscordServer) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("discord_automation_config" as any)
          .upsert(
            {
              user_id: user.id,
              server_id: server.id,
              server_name: server.name,
            },
            { onConflict: "user_id" }
          )
          .select()
          .single();

        if (error) throw error;

        const c = data as any;
        setConfig((prev) =>
          prev
            ? { ...prev, serverId: server.id, serverName: server.name }
            : {
                id: c.id,
                userId: user.id,
                serverId: server.id,
                serverName: server.name,
                channelId: null,
                channelName: null,
                isActive: false,
                triggerInstanceId: null,
                connectedAccountId: null,
                messagesTracked: 0,
                lastCheckedAt: null,
                triggerWord: "",
                triggerWordEnabled: false,
              }
        );

        // Fetch channels for this server
        const { data: channelData, error: channelError } =
          await supabase.functions.invoke("discord-automation-triggers", {
            body: { action: "get-channels", serverId: server.id },
          });

        if (channelError) throw channelError;
        if (channelData.error) {
          const errorMsg = extractErrorMessage(channelData);
          const isChannelAuthFailure = channelData.requiresReconnect === true;

          if (isChannelAuthFailure) {
            setNeedsReconnect(true);
          }

          toast({
            title: "Failed to load channels",
            description: errorMsg,
            variant: "destructive",
          });
          setChannels([]);
        } else {
          setNeedsReconnect(false);
          setChannels(channelData.channels || []);
        }

        setPhase("select-channel");
      } catch (error) {
        console.error("Failed to save server:", error);
        toast({
          title: "Failed to save server",
          description: "Could not save your server selection. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const selectChannel = useCallback(
    async (channel: DiscordChannel) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("discord_automation_config" as any)
          .update({
            channel_id: channel.id,
            channel_name: channel.name,
          })
          .eq("user_id", user.id);

        if (error) throw error;

        setConfig((prev) =>
          prev
            ? { ...prev, channelId: channel.id, channelName: channel.name }
            : null
        );
        setPhase("configure");
      } catch (error) {
        console.error("Failed to save channel:", error);
        toast({
          title: "Failed to save",
          description: "Could not save your channel selection. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  const activateMonitoring = useCallback(async () => {
    if (!config?.channelId) return;

    setPhase("activating");
    try {
      const { data, error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        {
          body: {
            action: "activate",
            channelId: config.channelId,
            serverId: config.serverId,
          },
        }
      );

      if (error) throw error;

      setConfig((prev) =>
        prev
          ? {
              ...prev,
              isActive: true,
              triggerInstanceId: data.triggerInstanceId || null,
              connectedAccountId: data.connectedAccountId || null,
            }
          : null
      );

      setPhase("active");
      toast({
        title: "Monitoring activated",
        description: "Your Discord channel is now being monitored.",
      });
    } catch (error) {
      console.error("Failed to activate:", error);
      setPhase("configure");
      toast({
        title: "Activation failed",
        description: "Could not start monitoring. Please try again.",
        variant: "destructive",
      });
    }
  }, [config, toast]);

  const deactivateMonitoring = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        {
          body: {
            action: "deactivate",
            triggerInstanceId: config?.triggerInstanceId,
          },
        }
      );

      if (error) throw error;

      setConfig((prev) => (prev ? { ...prev, isActive: false } : null));
      setPhase("configure");
      toast({
        title: "Monitoring paused",
        description: "Discord monitoring has been paused.",
      });
    } catch (error) {
      console.error("Failed to deactivate:", error);
      toast({
        title: "Deactivation failed",
        description: "Could not pause monitoring. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, toast]);

  const resetConfig = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      if (config?.isActive) {
        await supabase.functions.invoke("discord-automation-triggers", {
          body: {
            action: "deactivate",
            triggerInstanceId: config.triggerInstanceId,
          },
        });
      }

      await supabase
        .from("discord_automation_config" as any)
        .delete()
        .eq("user_id", user.id);

      setConfig(null);
      setServers([]);
      setChannels([]);
      setRecentMessages([]);
      setMessageCount(0);
      setTriggerWord("");
      setTriggerWordEnabled(false);
      setPhase("select-server");
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
  }, [config, toast]);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        { body: { action: "poll" } }
      );
      if (error) throw error;
      if (data?.error) {
        toast({
          title: "Sync failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      const count = data?.messagesImported ?? 0;
      toast({
        title: "Sync complete",
        description: count > 0
          ? `Imported ${count} new message${count > 1 ? "s" : ""}.`
          : "No new messages found.",
      });
      // Refresh config and recent messages
      await loadConfig();
      await loadRecentMessages();
    } catch (error) {
      console.error("Failed to sync:", error);
      toast({
        title: "Sync failed",
        description: "Could not sync messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig, loadRecentMessages]);

  const updateTriggerWord = useCallback(async (word: string, enabled: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase
        .from("discord_automation_config" as any)
        .update({ trigger_word: word || null, trigger_word_enabled: enabled })
        .eq("user_id", user.id);

      setTriggerWord(word);
      setTriggerWordEnabled(enabled);
      setConfig((prev) => prev ? { ...prev, triggerWord: word, triggerWordEnabled: enabled } : null);

      toast({
        title: "Trigger word updated",
        description: enabled && word
          ? `Only messages containing "${word}" will be saved`
          : "All messages will be saved",
      });
    } catch (error) {
      console.error("Failed to update trigger word:", error);
      toast({
        title: "Update failed",
        description: "Could not update trigger word settings.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const searchChannel = useCallback(async (query: string) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "discord-automation-triggers",
        { body: { action: "search", query } }
      );
      if (error) throw error;
      if (data?.error) {
        toast({
          title: "Search failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      const count = data?.messagesImported ?? 0;
      toast({
        title: "Search complete",
        description: count > 0
          ? `Found and imported ${count} matching message${count > 1 ? "s" : ""}.`
          : "No matching messages found.",
      });
      await loadConfig();
      await loadRecentMessages();
    } catch (error) {
      console.error("Failed to search:", error);
      toast({
        title: "Search failed",
        description: "Could not search messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig, loadRecentMessages]);

  return {
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
  };
}
