import { ChevronLeft, Hash, MessageSquare, Pause, RefreshCw, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DiscordAutomationStats } from "@/types/discordAutomation";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: DiscordAutomationStats;
  serverName: string;
  channelName: string;
  onPause: () => Promise<void>;
  onReset: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  isLoading: boolean;
  isSyncing: boolean;
}

export function ActiveMonitoring({
  stats,
  serverName,
  channelName,
  onPause,
  onReset,
  isLoading,
}: ActiveMonitoringProps) {
  const navigate = useNavigate();

  const lastCheckedText = stats.lastChecked
    ? formatDistanceToNow(new Date(stats.lastChecked), { addSuffix: true })
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
              Discord Message Tracker
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
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">{serverName}</p>
              <p className="text-sm text-muted-foreground">#{channelName}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#5865F2]/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-[#5865F2]" />
              </div>
              <span className="text-sm text-muted-foreground">Messages</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.messagesTracked}</p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-muted-foreground">Last Checked</span>
            </div>
            <p className="text-sm font-medium text-foreground">{lastCheckedText}</p>
          </div>
        </div>

        {/* How it works */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <h3 className="font-medium text-foreground mb-2">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 text-[#5865F2] mt-0.5 flex-shrink-0" />
              <span>
                When a new message is posted in #{channelName}, it's automatically saved as a memory.
              </span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onPause}
            disabled={isLoading}
            className="w-full h-12"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Monitoring
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
