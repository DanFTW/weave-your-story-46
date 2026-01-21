import { Image, MessageCircle, Heart, Clock, Pause, RefreshCw, Loader2, CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstagramEngagementStats } from "@/types/instagramAutomation";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: InstagramEngagementStats;
  isPolling: boolean;
  onPause: () => void;
  onCheckNow: () => void;
}

export function ActiveMonitoring({
  stats,
  isPolling,
  onPause,
  onCheckNow,
}: ActiveMonitoringProps) {
  const lastCheckedText = stats.lastChecked 
    ? formatDistanceToNow(new Date(stats.lastChecked), { addSuffix: true })
    : 'Never';

  return (
    <div className="space-y-6">
      {/* Active status badge */}
      <div className="flex items-center justify-center gap-2 py-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            Auto-Sync Active
          </span>
        </div>
      </div>

      {/* Auto-sync info card */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-foreground">Automatically Syncing</p>
            <p className="text-sm text-muted-foreground">
              Memories are created automatically every 5 minutes when new activity is detected
            </p>
          </div>
        </div>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
            <Image className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.postsTracked}</p>
          <p className="text-xs text-muted-foreground">Posts</p>
        </Card>

        <Card className="p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.commentsTracked}</p>
          <p className="text-xs text-muted-foreground">Comments</p>
        </Card>

        <Card className="p-4 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.likesTracked}</p>
          <p className="text-xs text-muted-foreground">Likes</p>
        </Card>
      </div>

      {/* Last checked */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Last Synced</p>
            <p className="text-sm text-muted-foreground">{lastCheckedText}</p>
          </div>
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      </Card>

      {/* How it works */}
      <Card className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          How It Works
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            We automatically check your Instagram every 5 minutes
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            New posts, comments, and significant engagement are saved as memories
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Each memory captures the context and content automatically
          </li>
        </ul>
      </Card>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          onClick={onCheckNow}
          disabled={isPolling}
          variant="outline"
          className="w-full h-12 gap-2"
        >
          {isPolling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Check Now
            </>
          )}
        </Button>

        <Button
          onClick={onPause}
          variant="ghost"
          className="w-full h-12 text-muted-foreground hover:text-foreground gap-2"
        >
          <Pause className="w-4 h-4" />
          Pause Monitoring
        </Button>
      </div>
    </div>
  );
}
