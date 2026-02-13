import { Hash, RefreshCw, ArrowLeft } from "lucide-react";
import { DiscordChannel } from "@/types/discordAutomation";

interface ChannelPickerProps {
  channels: DiscordChannel[];
  isLoading: boolean;
  serverName: string;
  needsReconnect: boolean;
  onSelectChannel: (channel: DiscordChannel) => void;
  onReconnect: () => void;
  onGoBack: () => void;
}

export function ChannelPicker({
  channels,
  isLoading,
  serverName,
  needsReconnect,
  onSelectChannel,
  onReconnect,
  onGoBack,
}: ChannelPickerProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-muted-foreground">Loading channels...</p>
      </div>
    );
  }

  if (channels.length === 0) {
    if (needsReconnect) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <RefreshCw className="w-12 h-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            Your Discord connection needs to be refreshed to list channels.
          </p>
          <button
            onClick={onReconnect}
            className="px-6 py-3 rounded-xl bg-[#5865F2] text-white font-medium hover:bg-[#4752C4] transition-colors"
          >
            Reconnect Discord
          </button>
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Pick a different server
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Hash className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">No text channels found in this server</p>
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Pick a different server
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Select which channel to monitor on{" "}
          <span className="font-medium text-foreground">{serverName}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          New messages in this channel will be saved as memories automatically.
        </p>
      </div>

      <div className="grid gap-3">
        {channels.map((channel) => (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center flex-shrink-0">
              <Hash className="w-5 h-5 text-[#5865F2]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{channel.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
