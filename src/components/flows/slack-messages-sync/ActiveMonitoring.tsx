import { useState, useCallback } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Hash, MessageSquare, Pause, RotateCcw, RefreshCw, User, Filter, Plus, Check, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { SlackMessagesSyncStats, SlackRecentMessage, SlackChannel } from "@/types/slackMessagesSync";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ActiveMonitoringProps {
  stats: SlackMessagesSyncStats;
  recentMessages: SlackRecentMessage[];
  onPause: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onSearch: (query: string) => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
  isPolling: boolean;
  triggerWord: string;
  triggerWordEnabled: boolean;
  onUpdateTriggerWord: (word: string, enabled: boolean) => Promise<void>;
}

export function ActiveMonitoring({
  stats,
  recentMessages,
  onPause,
  onSyncNow,
  onSearch,
  onReset,
  isLoading,
  isPolling,
  triggerWord,
  triggerWordEnabled,
  onUpdateTriggerWord,
}: ActiveMonitoringProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messagesOpen, setMessagesOpen] = useState(true);
  const [localTriggerWord, setLocalTriggerWord] = useState(triggerWord);

  // Channel picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableChannels, setAvailableChannels] = useState<SlackChannel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [channelsFetched, setChannelsFetched] = useState(false);
  const [addingChannelId, setAddingChannelId] = useState<string | null>(null);

  const lastPolledText = stats.lastPolled
    ? formatDistanceToNow(new Date(stats.lastPolled), { addSuffix: true })
    : "Never";

  const monitoredNames = new Set(stats.channelNames?.map(n => n.toLowerCase()) ?? []);

  const fetchChannels = useCallback(async () => {
    if (channelsFetched) return;
    setIsLoadingChannels(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-messages-sync", {
        body: { action: "list-channels" },
      });
      if (error) throw error;
      setAvailableChannels(data?.channels ?? []);
      setChannelsFetched(true);
    } catch (err) {
      console.error("Failed to fetch channels", err);
      toast({ title: "Failed to load channels", variant: "destructive" });
    } finally {
      setIsLoadingChannels(false);
    }
  }, [channelsFetched, toast]);

  const handleAddChannel = useCallback(async (channel: SlackChannel) => {
    if (monitoredNames.has(channel.name.toLowerCase())) return;
    setAddingChannelId(channel.id);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

      // Fetch current config
      const { data: configs, error: fetchErr } = await supabase
        .from("slack_messages_config")
        .select("id, selected_channel_ids, selected_workspace_ids")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1);

      if (fetchErr) throw fetchErr;
      const config = configs?.[0];
      if (!config) throw new Error("No active config found");

      const currentIds: string[] = config.selected_channel_ids ?? [];
      const currentNames: string[] = config.selected_workspace_ids ?? [];

      if (currentIds.includes(channel.id)) {
        toast({ title: "Channel already monitored" });
        return;
      }

      const { error: updateErr } = await supabase
        .from("slack_messages_config")
        .update({
          selected_channel_ids: [...currentIds, channel.id],
          selected_workspace_ids: [...currentNames, channel.name],
        })
        .eq("id", config.id);

      if (updateErr) throw updateErr;

      // Update local monitored set so UI reflects immediately
      stats.channelNames = [...(stats.channelNames ?? []), channel.name];
      toast({ title: `Now monitoring #${channel.name}` });
      setPickerOpen(false);
    } catch (err: any) {
      console.error("Failed to add channel", err);
      toast({ title: "Failed to add channel", description: err?.message, variant: "destructive" });
    } finally {
      setAddingChannelId(null);
    }
  }, [monitoredNames, stats, toast]);

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (open) fetchChannels();
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-purple")}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/threads")}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white truncate">
              Slack Message Monitor
            </h1>
            <p className="text-white/70 text-sm truncate">Monitoring active</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-white text-sm font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5 space-y-6">
        {/* Channel Info */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {(stats.channelNames && stats.channelNames.length > 0)
                  ? stats.channelNames.map(n => `#${n}`).join(", ")
                  : "#channel"}
              </p>
              <p className="text-sm text-muted-foreground">
                All messages imported as memories
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#4A154B]/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#4A154B]" />
              </div>
              <span className="text-sm text-muted-foreground">Imported</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.messagesImported}</p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-muted-foreground">Last Synced</span>
            </div>
            <p className="text-sm font-medium text-foreground">{lastPolledText}</p>
          </div>
        </div>

        {/* Recent Messages */}
        <Collapsible open={messagesOpen} onOpenChange={setMessagesOpen}>
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#4A154B]" />
                  <span className="font-medium text-foreground text-sm">Recent Messages</span>
                  {recentMessages.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#4A154B]/10 text-[#4A154B] text-xs font-medium">
                      {recentMessages.length}
                    </span>
                  )}
                </div>
                {messagesOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border">
                {recentMessages.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No messages imported yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Tap "Sync Now" to import messages</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {recentMessages.map((msg) => (
                      <div key={msg.id} className="px-4 py-3 flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {msg.authorName || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {msg.messageContent || "No content"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Trigger Word Filter */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#4A154B]" />
              <p className="font-medium text-foreground text-sm">Trigger Word</p>
            </div>
            <Switch
              checked={triggerWordEnabled}
              onCheckedChange={(checked) => onUpdateTriggerWord(localTriggerWord, checked)}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={localTriggerWord}
              onChange={(e) => setLocalTriggerWord(e.target.value)}
              onBlur={() => {
                if (localTriggerWord !== triggerWord) {
                  onUpdateTriggerWord(localTriggerWord, triggerWordEnabled);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && localTriggerWord !== triggerWord) {
                  onUpdateTriggerWord(localTriggerWord, triggerWordEnabled);
                }
              }}
              placeholder="e.g. urgent, action-item..."
              className="flex-1 h-10 px-3 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4A154B]/30"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {triggerWordEnabled && triggerWord
              ? `Only messages containing "${triggerWord}" will be saved`
              : "When enabled, only messages with the trigger word are saved"}
          </p>
        </div>

        {/* Add Channel Picker */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-[#4A154B]" />
            <p className="font-medium text-foreground text-sm">Add Channel</p>
          </div>
          <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-10 justify-start text-muted-foreground font-normal"
              >
                <Hash className="w-4 h-4 mr-2 text-[#4A154B]" />
                Select a channel to add...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search channels..." />
                <CommandList className="max-h-60">
                  <CommandEmpty>
                    {isLoadingChannels ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading channels...</span>
                      </div>
                    ) : (
                      "No channels found"
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {availableChannels.map((channel) => {
                      const isMonitored = monitoredNames.has(channel.name.toLowerCase());
                      const isAdding = addingChannelId === channel.id;
                      return (
                        <CommandItem
                          key={channel.id}
                          value={channel.name}
                          onSelect={() => !isMonitored && !isAdding && handleAddChannel(channel)}
                          disabled={isMonitored || isAdding}
                          className={cn(
                            "flex items-center gap-3",
                            isMonitored && "opacity-50"
                          )}
                        >
                          <div className="w-6 h-6 rounded bg-[#4A154B]/10 flex items-center justify-center flex-shrink-0">
                            {channel.isPrivate ? (
                              <Lock className="w-3.5 h-3.5 text-[#4A154B]" />
                            ) : (
                              <Hash className="w-3.5 h-3.5 text-[#4A154B]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-foreground truncate block">
                              {channel.isPrivate ? "🔒 " : "#"}{channel.name}
                            </span>
                            {channel.numMembers !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                {channel.numMembers} members
                              </span>
                            )}
                          </div>
                          {isMonitored && (
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          )}
                          {isAdding && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground mt-2">
            Add more channels to monitor for messages
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onSyncNow}
            disabled={isLoading || isPolling}
            className="w-full h-12"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? "animate-spin" : ""}`} />
            {isPolling ? "Syncing..." : "Sync Now"}
          </Button>

          <Button
            variant="outline"
            onClick={onPause}
            disabled={isLoading}
            className="w-full h-12"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Monitor
          </Button>

          <Button
            variant="ghost"
            onClick={onReset}
            disabled={isLoading}
            className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
