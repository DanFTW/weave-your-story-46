import { MapPin, Bookmark, Pause, RefreshCw, Loader2, ExternalLink, UtensilsCrossed } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RestaurantBookmarkSyncStats, PendingRestaurantBookmark } from "@/types/restaurantBookmarkSync";
import { PendingBookmarkCard } from "./PendingBookmarkCard";

interface ActiveMonitoringProps {
  stats: RestaurantBookmarkSyncStats;
  pendingBookmarks: PendingRestaurantBookmark[];
  completedBookmarks: PendingRestaurantBookmark[];
  onPause: () => Promise<boolean>;
  onUpdateBookmark: (bookmarkId: string, fields: { restaurantName?: string; restaurantAddress?: string; restaurantCuisine?: string; restaurantNotes?: string }) => Promise<void>;
  onPushBookmark: (bookmarkId: string) => Promise<boolean>;
  onDismiss: (bookmarkId: string) => Promise<void>;
  isPushing: string | null;
  onManualSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export function ActiveMonitoring({
  stats,
  pendingBookmarks,
  completedBookmarks,
  onPause,
  onUpdateBookmark,
  onPushBookmark,
  onDismiss,
  isPushing,
  onManualSync,
  isSyncing = false,
}: ActiveMonitoringProps) {
  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
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

      {/* Stats */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.restaurantsBookmarked}</p>
          <p className="text-sm text-muted-foreground">Restaurants bookmarked</p>
        </div>
      </div>

      {/* Sync now button */}
      {onManualSync && (
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
              Scan existing memories for restaurants
            </p>
          </div>
        </button>
      )}

      {/* Pending queue */}
      {pendingBookmarks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Needs your input ({pendingBookmarks.length})
          </h3>
          {pendingBookmarks.map((bookmark) => (
            <PendingBookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onUpdate={onUpdateBookmark}
              onPush={onPushBookmark}
              onDismiss={onDismiss}
              isPushing={isPushing === bookmark.id}
            />
          ))}
        </div>
      )}

      {/* Completed / history */}
      {completedBookmarks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Previously found ({completedBookmarks.length})
          </h3>
          {completedBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UtensilsCrossed className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">
                  {bookmark.restaurantName || "Unknown restaurant"}
                </p>
                {bookmark.restaurantAddress && (
                  <p className="text-muted-foreground text-xs truncate mt-0.5">
                    {bookmark.restaurantAddress}
                  </p>
                )}
                {bookmark.restaurantCuisine && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {bookmark.restaurantCuisine}
                  </p>
                )}
              </div>
              {bookmark.googleMapsUrl && (
                <a
                  href={bookmark.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"
                >
                  <ExternalLink className="w-4 h-4 text-primary" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause restaurant sync
      </button>
    </div>
  );
}
