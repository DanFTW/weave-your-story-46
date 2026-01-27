import { UserPlus, Pause, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubSpotContactStats } from "@/types/hubspotAutomation";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: HubSpotContactStats;
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
      {/* Status Card */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monitoring Active</h3>
            <p className="text-sm text-muted-foreground">Tracking new HubSpot contacts</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.contactsTracked}</div>
            <div className="text-xs text-muted-foreground mt-1">Contacts Tracked</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-sm font-medium text-foreground">{lastCheckedText}</div>
            <div className="text-xs text-muted-foreground mt-1">Last Checked</div>
          </div>
        </div>
      </div>

      {/* What's being monitored */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">Monitoring</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-lg bg-[#FF7A59]/10 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-[#FF7A59]" />
          </div>
          <span className="text-foreground">New Contacts</span>
          <span className="ml-auto text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCheckNow}
          disabled={isPolling}
          className="flex-1"
        >
          {isPolling ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Check Now
        </Button>
        <Button
          variant="outline"
          onClick={onPause}
          className="flex-1"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      </div>
    </div>
  );
}
