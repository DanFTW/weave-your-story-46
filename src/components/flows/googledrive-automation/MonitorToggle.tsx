import { Zap, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { GoogleDriveDocStats } from "@/types/googleDriveAutomation";

interface MonitorToggleProps {
  isActive: boolean;
  stats: GoogleDriveDocStats;
  isActivating: boolean;
  onToggle: (enabled: boolean) => void;
}

export function MonitorToggle({ isActive, stats, isActivating, onToggle }: MonitorToggleProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#4285F4]/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#4285F4]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Automatic Monitoring</h3>
            <p className="text-xs text-muted-foreground">Save new documents as memories</p>
          </div>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={onToggle}
          disabled={isActivating}
        />
      </div>

      {isActive && (
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-600 font-medium">Active</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            <span>{stats.documentsSaved} doc{stats.documentsSaved !== 1 ? "s" : ""} saved</span>
          </div>
          {stats.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              Last: {new Date(stats.lastSyncAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
