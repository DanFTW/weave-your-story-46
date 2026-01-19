import { format } from "date-fns";
import { RefreshCw, Settings, PenLine, MessageSquare, Calendar, Loader2, RotateCcw, Heart, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TwitterSyncConfig, Tweet } from "@/types/twitterSync";
import { TweetPreviewCard } from "./TweetPreviewCard";

interface TwitterSyncActiveProps {
  syncConfig: TwitterSyncConfig;
  recentTweets: Tweet[];
  isSyncing: boolean;
  onSyncNow: () => void;
  onConfigure: () => void;
  onResetSync?: () => void;
}

export function TwitterSyncActive({
  syncConfig,
  recentTweets,
  isSyncing,
  onSyncNow,
  onConfigure,
  onResetSync,
}: TwitterSyncActiveProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <PenLine className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Tweets Synced</span>
          </div>
          <p className="text-2xl font-bold">{syncConfig.tweetsSyncedCount}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Memories</span>
          </div>
          <p className="text-2xl font-bold">{syncConfig.memoriesCreatedCount}</p>
        </div>
      </div>

      {/* Last Sync */}
      {syncConfig.lastSyncAt && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>Last synced: {format(new Date(syncConfig.lastSyncAt), "MMM d, yyyy 'at' h:mm a")}</span>
        </div>
      )}

      {/* Sync Settings Summary */}
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Current Settings</h3>
          <button
            onClick={onConfigure}
            className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />
              Tweets
            </span>
            <span className={syncConfig.syncTweets ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncTweets ? "On" : "Off"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Repeat2 className="w-3.5 h-3.5" />
              Retweets
            </span>
            <span className={syncConfig.syncRetweets ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncRetweets ? "On" : "Off"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Replies
            </span>
            <span className={syncConfig.syncReplies ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncReplies ? "On" : "Off"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              Likes
            </span>
            <span className={syncConfig.syncLikes ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncLikes ? "On" : "Off"}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Tweets Preview */}
      {recentTweets.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Recent Tweets
          </h3>
          <div className="space-y-3">
            {recentTweets.slice(0, 5).map((tweet) => (
              <TweetPreviewCard key={tweet.id} tweet={tweet} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5 mr-2" />
              Sync Now
            </>
          )}
        </Button>
        
        {onResetSync && (
          <Button
            onClick={onResetSync}
            variant="outline"
            disabled={isSyncing}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset & Re-sync All Tweets
          </Button>
        )}
      </div>
    </div>
  );
}
