import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DiscordAutomationPhase,
  DiscordServer,
  DiscordChannel,
  DiscordAutomationConfig,
  DiscordAutomationStats,
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

  const stats: DiscordAutomationStats = {
    messagesTracked: config?.messagesTracked ?? 0,
    lastChecked: config?.lastCheckedAt ?? null,
    isActive: config?.isActive ?? false,
  };

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
      });

      if (c.is_active) {
        setPhase("active");
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
  }, []);

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
        // Detect "all connections failed" → user needs to reconnect
        const isAuthFailure =
          data.details?.includes("All available Discord connections failed") ||
          data.error?.includes("reconnect");
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
              }
        );

        // Fetch channels for this server
        const { data: channelData, error: channelError } =
          await supabase.functions.invoke("discord-automation-triggers", {
            body: { action: "get-channels", serverId: server.id },
          });

        if (channelError) throw channelError;
        if (channelData.error) {
          toast({
            title: "Failed to load channels",
            description: extractErrorMessage(channelData),
            variant: "destructive",
          });
          setChannels([]);
        } else {
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
  };
}
