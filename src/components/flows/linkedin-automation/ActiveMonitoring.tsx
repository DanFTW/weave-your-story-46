import { UserPlus, RefreshCw, Pause, Chrome } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { LinkedInConnectionStats } from "@/types/linkedinAutomation";
import { ExtensionStatus } from "./ExtensionStatus";
import { ExtensionSetupGuide } from "./ExtensionSetupGuide";

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
  const lastCheckedText = stats.extensionLastEventAt
    ? formatDistanceToNow(new Date(stats.extensionLastEventAt), { addSuffix: true })
    : stats.lastChecked
    ? formatDistanceToNow(new Date(stats.lastChecked), { addSuffix: true })
    : "Never";

  // Determine if extension is set up
  const hasExtension = stats.extensionEnabled || stats.extensionLastEventAt;

  return (
    <div className="space-y-6">
      {/* Extension Status Badge */}
      <div className="flex justify-center">
        <ExtensionStatus 
          lastEventAt={stats.extensionLastEventAt}
          extensionEnabled={stats.extensionEnabled}
          connectionsTracked={stats.connectionsTracked}
        />
      </div>

      {/* Extension Setup Guide (if not installed) */}
      {!hasExtension && (
        <ExtensionSetupGuide />
      )}

      {/* Status Card */}
      {hasExtension && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <Chrome className="w-5 h-5 text-[#0A66C2]" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">Browser Extension Active</p>
              <p className="text-sm text-muted-foreground">
                New connections are captured automatically while browsing LinkedIn
              </p>
            </div>
          </div>
        </Card>
      )}

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
          <p className="text-sm text-muted-foreground">Last Captured</p>
        </Card>
      </div>

      {/* How it works */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-medium text-foreground mb-2">How It Works</h4>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• Install the Weave browser extension for Chrome</li>
          <li>• Browse LinkedIn normally - new connections are detected automatically</li>
          <li>• Each new contact is saved with their profile info</li>
          <li>• Memories include name, headline, company & location</li>
          <li>• Duplicates are automatically prevented</li>
        </ul>
      </Card>

      {/* Action Button */}
      <Button
        onClick={onPause}
        variant="outline"
        className="w-full"
      >
        <Pause className="w-4 h-4 mr-2" />
        Pause Auto-Capture
      </Button>
    </div>
  );
}
