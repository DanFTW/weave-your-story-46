import { format } from "date-fns";
import { RefreshCw, FileText, MessageSquare, Calendar, Loader2, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacebookSyncConfig, FacebookSyncResult } from "@/types/facebookSync";

interface FacebookSyncActiveProps {
  syncConfig: FacebookSyncConfig;
  isSyncing: boolean;
  lastSyncResult: FacebookSyncResult | null;
  onSyncNow: () => void;
  onResetSync?: () => void;
}

export function FacebookSyncActive({
  syncConfig,
  isSyncing,
  lastSyncResult,
  onSyncNow,
  onResetSync,
}: FacebookSyncActiveProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts Synced</span>
          </div>
          <p className="text-2xl font-bold">{syncConfig.postsSyncedCount}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
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

      {/* Last Sync Result */}
      {lastSyncResult && lastSyncResult.success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {lastSyncResult.memoriesCreated > 0 
                ? `Imported ${lastSyncResult.memoriesCreated} new post${lastSyncResult.memoriesCreated !== 1 ? 's' : ''}`
                : "All caught up — no new posts to import"}
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#1877F2] to-[#0062E0] hover:from-[#166FE5] hover:to-[#0058CC] text-white"
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
            Reset & Re-sync All Posts
          </Button>
        )}
      </div>
    </div>
  );
}
