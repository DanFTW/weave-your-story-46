import { ChevronLeft, Hash, MessageSquare, Pause, RotateCcw, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SlackMessagesSyncStats } from "@/types/slackMessagesSync";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: SlackMessagesSyncStats;
  selectedChannelCount: number;
  onPause: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
  isPolling: boolean;
}

export function ActiveMonitoring({
  stats,
  selectedChannelCount,
  onPause,
  onSyncNow,
  onReset,
  isLoading,
  isPolling,
}: ActiveMonitoringProps) {
  const navigate = useNavigate();

  const lastPolledText = stats.lastPolled
    ? formatDistanceToNow(new Date(stats.lastPolled), { addSuffix: true })
    : "Never";

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
              Slack Messages to Memory
            </h1>
            <p className="text-white/70 text-sm truncate">Sync active</p>
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">{selectedChannelCount} channels</p>
              <p className="text-sm text-muted-foreground">
                {stats.searchMode ? "Search mode" : "Passive import"}
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

        {/* Mode indicator */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            {stats.searchMode ? (
              <Search className="w-5 h-5 text-[#4A154B]" />
            ) : (
              <Hash className="w-5 h-5 text-[#4A154B]" />
            )}
            <div>
              <p className="font-medium text-foreground text-sm">
                {stats.searchMode ? "Search & Import Mode" : "Passive Import Mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.searchMode
                  ? "Searching content across selected channels"
                  : "Importing recent messages from selected channels"}
              </p>
            </div>
          </div>
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
            Pause Sync
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
