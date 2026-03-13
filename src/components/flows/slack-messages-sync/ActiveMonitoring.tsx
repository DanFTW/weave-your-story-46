import { useState } from "react";
import { ChevronLeft, ChevronDown, ChevronUp, Hash, MessageSquare, Pause, RotateCcw, RefreshCw, Search, User, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SlackMessagesSyncStats, SlackRecentMessage } from "@/types/slackMessagesSync";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: SlackMessagesSyncStats;
  recentMessages: SlackRecentMessage[];
  onPause: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onSearch: (query: string) => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
  isPolling: boolean;
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
}: ActiveMonitoringProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [messagesOpen, setMessagesOpen] = useState(true);

  const lastPolledText = stats.lastPolled
    ? formatDistanceToNow(new Date(stats.lastPolled), { addSuffix: true })
    : "Never";

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
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

        {/* Search */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-[#4A154B]" />
            <p className="font-medium text-foreground text-sm">Search Channel</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search messages..."
              className="flex-1 h-10 px-3 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#4A154B]/30"
            />
            <Button
              size="sm"
              onClick={handleSearch}
              disabled={isPolling || !searchQuery.trim()}
              className="h-10 bg-[#4A154B] hover:bg-[#4A154B]/90"
            >
              {isPolling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Search across channel content and save matches as memories
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
