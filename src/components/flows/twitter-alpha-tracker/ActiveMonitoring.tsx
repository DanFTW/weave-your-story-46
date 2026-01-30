import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  RefreshCw,
  Pause,
  Plus,
  CheckCircle2,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TwitterAlphaTrackerStats } from "@/types/twitterAlphaTracker";
import { User } from "lucide-react";

interface ActiveMonitoringProps {
  stats: TwitterAlphaTrackerStats;
  onPause: () => void;
  onCheckNow: () => void;
  onAddAccount: () => void;
  onRemoveAccount: (username: string) => void;
  onResetSync: () => void;
}

export function ActiveMonitoring({
  stats,
  onPause,
  onCheckNow,
  onAddAccount,
  onRemoveAccount,
  onResetSync,
}: ActiveMonitoringProps) {
  const navigate = useNavigate();
  const { trackedAccounts } = stats;

  const lastCheckedText = stats.lastChecked
    ? formatDistanceToNow(new Date(stats.lastChecked), { addSuffix: true })
    : "Never";

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 thread-gradient-blue">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/threads")}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              Twitter Alpha Tracker
            </h1>
            <p className="text-white/70 text-sm truncate">Active monitoring</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-6 space-y-6">
        {/* Stale Sync Warning Banner */}
        {stats.totalPostsTracked > 50 && stats.lastChecked && (
          <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10">
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
              <strong>Sync Update Available</strong>
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              We've improved how Twitter posts are saved as memories. 
              Click below to re-sync your tracked posts with the new format.
            </p>
            <Button onClick={onResetSync} size="sm" variant="outline" className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset & Re-sync All Posts
            </Button>
          </div>
        )}

        {/* Status Card */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Tracking Active
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {trackedAccounts.length} account{trackedAccounts.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Background sync every minute
          </p>

          {/* Tracked Accounts List */}
          <div className="space-y-2">
            {trackedAccounts.map((account) => (
              <div
                key={account.username}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
              >
                <Avatar className="w-10 h-10">
                  {account.avatarUrl ? (
                    <AvatarImage
                      src={account.avatarUrl}
                      alt={account.displayName}
                    />
                  ) : null}
                  <AvatarFallback>
                    <User className="w-4 h-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {account.displayName || account.username}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    @{account.username}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-foreground">
                    {account.postsTracked}
                  </p>
                  <p className="text-xs text-muted-foreground">posts</p>
                </div>

                {trackedAccounts.length > 1 && (
                  <button
                    onClick={() => onRemoveAccount(account.username)}
                    className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-destructive/10 flex-shrink-0"
                  >
                    <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add Account Button */}
          <button
            onClick={onAddAccount}
            className="w-full mt-3 p-3 rounded-lg border border-dashed border-border flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add another account
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {stats.totalPostsTracked}
            </p>
            <p className="text-sm text-muted-foreground">Total Posts</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground truncate">
              {lastCheckedText}
            </p>
            <p className="text-sm text-muted-foreground">Last Checked</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button onClick={onCheckNow} className="w-full" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Now
          </Button>

          <Button onClick={onPause} className="w-full" variant="outline">
            <Pause className="w-4 h-4 mr-2" />
            Pause Tracking
          </Button>
        </div>

        {/* Danger Zone */}
        <div className="pt-6 mt-6 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">
            Clear sync history to re-process all recent tweets with updated formatting.
          </p>
          <Button onClick={onResetSync} className="w-full" variant="ghost" size="sm">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Sync History
          </Button>
        </div>
      </div>
    </div>
  );
}
