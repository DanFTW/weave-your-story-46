import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft,
  Twitter,
  User,
  RefreshCw,
  Pause,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TwitterAlphaTrackerStats } from "@/types/twitterAlphaTracker";

interface ActiveMonitoringProps {
  stats: TwitterAlphaTrackerStats;
  onPause: () => void;
  onCheckNow: () => void;
  onChangeAccount: () => void;
}

export function ActiveMonitoring({
  stats,
  onPause,
  onCheckNow,
  onChangeAccount,
}: ActiveMonitoringProps) {
  const navigate = useNavigate();
  const account = stats.trackedAccount;

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
        {/* Status Card */}
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Tracking Active
            </span>
          </div>

          {account && (
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                {account.avatarUrl ? (
                  <AvatarImage
                    src={account.avatarUrl}
                    alt={account.displayName}
                  />
                ) : null}
                <AvatarFallback>
                  <User className="w-6 h-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-lg truncate">
                  {account.displayName || account.username}
                </p>
                <p className="text-muted-foreground truncate">
                  @{account.username}
                </p>
              </div>

              <Twitter className="w-6 h-6 text-primary flex-shrink-0" />
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card text-center">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-foreground">
              {stats.postsTracked}
            </p>
            <p className="text-sm text-muted-foreground">Posts Tracked</p>
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
            Check Now
          </Button>

          <Button onClick={onPause} className="w-full" variant="outline">
            <Pause className="w-4 h-4 mr-2" />
            Pause Tracking
          </Button>

          <Button onClick={onChangeAccount} className="w-full" variant="ghost">
            <Settings className="w-4 h-4 mr-2" />
            Change Account
          </Button>
        </div>
      </div>
    </div>
  );
}
