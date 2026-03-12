import { useEffect } from "react";
import { Hash, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackChannel } from "@/types/slackMessagesSync";

interface ChannelPickerProps {
  channels: SlackChannel[];
  isLoading: boolean;
  onSelectChannel: (channel: SlackChannel) => void;
  onRefresh: () => void;
}

export function ChannelPicker({
  channels,
  isLoading,
  onSelectChannel,
  onRefresh,
}: ChannelPickerProps) {
  useEffect(() => {
    if (channels.length === 0) {
      onRefresh();
    }
  }, []);

  if (isLoading && channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#4A154B] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Loading channels...</p>
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Hash className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">No channels found</p>
        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select a channel to monitor.
        </p>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-[#4A154B]/10 flex items-center justify-center flex-shrink-0">
              {channel.isPrivate ? (
                <Lock className="w-5 h-5 text-[#4A154B]" />
              ) : (
                <Hash className="w-5 h-5 text-[#4A154B]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {channel.isPrivate ? "🔒 " : "#"}{channel.name}
              </p>
              {channel.numMembers !== undefined && (
                <p className="text-xs text-muted-foreground">
                  {channel.numMembers} members
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
