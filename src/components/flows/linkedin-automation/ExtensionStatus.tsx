import { Wifi, WifiOff, Puzzle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface ExtensionStatusProps {
  lastEventAt: string | null;
  extensionEnabled: boolean;
  connectionsTracked: number;
}

export function ExtensionStatus({ 
  lastEventAt, 
  extensionEnabled,
  connectionsTracked 
}: ExtensionStatusProps) {
  // Consider extension active if we've received an event in the last 5 minutes
  const isRecentlyActive = lastEventAt 
    ? (Date.now() - new Date(lastEventAt).getTime()) < 5 * 60 * 1000
    : false;

  const lastEventText = lastEventAt
    ? formatDistanceToNow(new Date(lastEventAt), { addSuffix: true })
    : "Never";

  if (!extensionEnabled && !lastEventAt) {
    return (
      <Badge 
        variant="secondary" 
        className="bg-muted text-muted-foreground border-border px-4 py-2 text-sm font-medium"
      >
        <Puzzle className="w-4 h-4 mr-2" />
        Extension Not Installed
      </Badge>
    );
  }

  if (isRecentlyActive) {
    return (
      <div className="space-y-2 text-center">
        <Badge 
          variant="secondary" 
          className="bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20 px-4 py-2 text-sm font-medium"
        >
          <Wifi className="w-4 h-4 mr-2" />
          Extension Active
        </Badge>
        <p className="text-xs text-muted-foreground">
          Last capture: {lastEventText}
        </p>
      </div>
    );
  }

  if (extensionEnabled) {
    return (
      <div className="space-y-2 text-center">
        <Badge 
          variant="secondary" 
          className="bg-muted text-muted-foreground border-border px-4 py-2 text-sm font-medium"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          Extension Idle
        </Badge>
        <p className="text-xs text-muted-foreground">
          Last capture: {lastEventText}
        </p>
      </div>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className="bg-muted text-muted-foreground border-border px-4 py-2 text-sm font-medium"
    >
      <WifiOff className="w-4 h-4 mr-2" />
      Extension Not Connected
    </Badge>
  );
}
