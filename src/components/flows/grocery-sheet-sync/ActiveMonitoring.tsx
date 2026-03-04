import { ShoppingCart, FileSpreadsheet, Pause, RefreshCw, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { GrocerySheetSyncStats } from "@/types/grocerySheetSync";

interface ActiveMonitoringProps {
  stats: GrocerySheetSyncStats;
  sheetName: string;
  onPause: () => Promise<boolean>;
  onManualSync: () => Promise<void>;
  isSyncing: boolean;
}

export function ActiveMonitoring({
  stats,
  sheetName,
  onPause,
  onManualSync,
  isSyncing,
}: ActiveMonitoringProps) {
  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Auto-sync</h3>
              <p className="text-muted-foreground text-sm">
                {stats.isActive ? "Active" : "Paused"}
              </p>
            </div>
          </div>
          <Switch
            checked={stats.isActive}
            onCheckedChange={(checked) => {
              if (!checked) onPause();
            }}
          />
        </div>
      </div>

      {/* Target sheet */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Posting to</p>
          <p className="text-base font-semibold text-foreground truncate">{sheetName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.itemsPosted}</p>
          <p className="text-sm text-muted-foreground">Items posted</p>
        </div>
      </div>

      {/* Sync now button */}
      <button
        onClick={onManualSync}
        disabled={isSyncing}
        className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/50 transition-colors disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground text-base">
            {isSyncing ? "Syncing…" : "Sync now"}
          </p>
          <p className="text-sm text-muted-foreground">
            Scan existing memories for grocery items
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause grocery sync
      </button>
    </div>
  );
}
