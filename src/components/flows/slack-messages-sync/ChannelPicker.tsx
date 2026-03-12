import { useEffect } from "react";
import { Hash, Lock, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackChannel } from "@/types/slackMessagesSync";

interface ChannelPickerProps {
  channels: SlackChannel[];
  selectedChannelIds: string[];
  isLoading: boolean;
  onToggleChannel: (channelId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onRefresh: () => void;
  onDone: () => void;
}

export function ChannelPicker({
  channels,
  selectedChannelIds,
  isLoading,
  onToggleChannel,
  onSelectAll,
  onDeselectAll,
  onRefresh,
  onDone,
}: ChannelPickerProps) {
  // Auto-fetch channels on mount
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

  const allSelected = selectedChannelIds.length === channels.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Select channels to import messages from.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-xs"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {channels.map((channel) => {
          const isSelected = selectedChannelIds.includes(channel.id);
          return (
            <button
              key={channel.id}
              onClick={() => onToggleChannel(channel.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                isSelected
                  ? "bg-accent/50 border-primary/50"
                  : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isSelected ? "bg-[#4A154B]" : "bg-[#4A154B]/10"
              }`}>
                {isSelected ? (
                  <Check className="w-4 h-4 text-white" />
                ) : channel.isPrivate ? (
                  <Lock className="w-4 h-4 text-[#4A154B]" />
                ) : (
                  <Hash className="w-4 h-4 text-[#4A154B]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground text-sm truncate">
                  {channel.isPrivate ? "🔒 " : "#"}{channel.name}
                </p>
                {channel.numMembers !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {channel.numMembers} members
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Continue Button */}
      <Button
        onClick={onDone}
        disabled={selectedChannelIds.length === 0}
        className="w-full h-14 text-lg rounded-xl bg-[#4A154B] hover:bg-[#4A154B]/90"
      >
        Continue with {selectedChannelIds.length} channel{selectedChannelIds.length !== 1 ? "s" : ""}
      </Button>
    </div>
  );
}
