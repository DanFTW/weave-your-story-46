import { UserPlus, Loader2, Pause, RefreshCw, Wifi, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { LinkedInConnectionStats } from "@/types/linkedinAutomation";

interface ActiveMonitoringProps {
  stats: LinkedInConnectionStats;
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
    : "Never";

  return (
    <div className="space-y-6">
      {/* Active Badge */}
      <div className="flex justify-center">
        <Badge 
          variant="secondary" 
          className="bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20 px-4 py-2 text-sm font-medium"
        >
          <Wifi className="w-4 h-4 mr-2" />
          Background Sync Active
        </Badge>
      </div>

      {/* Status Card */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Monitoring Active</p>
            <p className="text-sm text-muted-foreground">
              New connections will be saved automatically
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-[#0A66C2]" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.connectionsTracked}</p>
          <p className="text-sm text-muted-foreground">Contacts Saved</p>
        </Card>

        <Card className="p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{lastCheckedText}</p>
          <p className="text-sm text-muted-foreground">Last Synced</p>
        </Card>
      </div>

      {/* How it works */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-medium text-foreground mb-2">How It Works</h4>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• We check for new connections every 15 minutes</li>
          <li>• Each new contact is saved with their full profile</li>
          <li>• Memories include name, headline, company & location</li>
          <li>• Duplicates are automatically prevented</li>
        </ul>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onCheckNow}
          disabled={isPolling}
          variant="outline"
          className="flex-1"
        >
          {isPolling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>

        <Button
          onClick={onPause}
          variant="outline"
          className="flex-1"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pause Syncing
        </Button>
      </div>
    </div>
  );
}
