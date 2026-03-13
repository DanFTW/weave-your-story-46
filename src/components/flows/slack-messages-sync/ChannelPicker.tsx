import { useEffect, useState } from "react";
import { Hash, Lock, RefreshCw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SlackChannel } from "@/types/slackMessagesSync";

interface ChannelPickerProps {
  channels: SlackChannel[];
  isLoading: boolean;
  onConfirmChannels: (channels: SlackChannel[]) => void;
  onRefresh: () => void;
}

export function ChannelPicker({
  channels,
  isLoading,
  onConfirmChannels,
  onRefresh,
}: ChannelPickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (channels.length === 0) {
      onRefresh();
    }
  }, []);

  const toggleChannel = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedChannels = channels.filter((c) => selectedIds.has(c.id));

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
          Select channels or DMs to monitor.
        </p>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        {channels.map((channel) => {
          const isSelected = selectedIds.has(channel.id);
          return (
            <button
              key={channel.id}
              onClick={() => toggleChannel(channel.id)}
              className={`flex items-center gap-4 p-4 rounded-xl bg-card border transition-all text-left ${
                isSelected
                  ? "border-[#4A154B] bg-[#4A154B]/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleChannel(channel.id)}
                className="data-[state=checked]:bg-[#4A154B] data-[state=checked]:border-[#4A154B]"
              />
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
          );
        })}
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-6 pt-4">
          <Button
            onClick={() => onConfirmChannels(selectedChannels)}
            className="w-full h-12 bg-[#4A154B] hover:bg-[#3a1040] text-white font-semibold rounded-2xl"
          >
            Start Monitoring ({selectedIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}
