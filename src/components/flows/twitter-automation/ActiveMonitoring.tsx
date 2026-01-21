import { useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Wifi, PenLine, MessageSquare, Repeat2, Heart, Clock, Loader2, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TwitterEngagementStats } from "@/types/twitterAutomation";

interface ActiveMonitoringProps {
  stats: TwitterEngagementStats;
  isPolling: boolean;
  onPause: () => Promise<boolean>;
  onCheckNow: () => Promise<boolean>;
}

export function ActiveMonitoring({
  stats,
  isPolling,
  onPause,
  onCheckNow,
}: ActiveMonitoringProps) {
  const hasPolledOnMount = useRef(false);

  // Auto-poll on mount and every 30 seconds while viewing
  useEffect(() => {
    // Initial poll when component mounts (if not already polling)
    if (!hasPolledOnMount.current && !isPolling) {
      hasPolledOnMount.current = true;
      onCheckNow();
    }

    // Set up interval for subsequent polls
    const interval = setInterval(() => {
      if (!isPolling) {
        onCheckNow();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isPolling, onCheckNow]);

  const lastCheckedText = stats.lastChecked
    ? formatDistanceToNow(new Date(stats.lastChecked), { addSuffix: true })
    : "Never";

  return (
    <div className="space-y-6">
      {/* Active Status Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-2 px-4 py-2">
          <Wifi className="w-4 h-4" />
          Auto-Sync Active
        </Badge>
      </div>

      {/* Status Card */}
      <Card className="p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground text-center">
          We're automatically checking your Twitter every 5 minutes and 
          saving new activity as memories.
        </p>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <PenLine className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{stats.postsTracked}</p>
          <p className="text-sm text-muted-foreground">Tweets</p>
        </Card>

        <Card className="p-4 text-center">
          <MessageSquare className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{stats.repliesTracked}</p>
          <p className="text-sm text-muted-foreground">Replies</p>
        </Card>

        <Card className="p-4 text-center">
          <Repeat2 className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{stats.retweetsTracked}</p>
          <p className="text-sm text-muted-foreground">Retweets</p>
        </Card>

        <Card className="p-4 text-center">
          <Heart className="w-5 h-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold">{stats.likesTracked}</p>
          <p className="text-sm text-muted-foreground">Likes</p>
        </Card>
      </div>

      {/* Last Synced */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Last Synced</p>
              <p className="text-sm text-muted-foreground">{lastCheckedText}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* How It Works */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">How It Works</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• We check your Twitter account every 5 minutes</li>
          <li>• New tweets, replies, retweets & likes become memories</li>
          <li>• Each item is only saved once (no duplicates)</li>
          <li>• Pause anytime to stop automatic syncing</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onCheckNow}
          disabled={isPolling}
          variant="outline"
          className="w-full"
        >
          {isPolling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            "Check Now"
          )}
        </Button>

        <Button
          onClick={onPause}
          variant="ghost"
          className="w-full text-muted-foreground"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pause Monitoring
        </Button>
      </div>
    </div>
  );
}
