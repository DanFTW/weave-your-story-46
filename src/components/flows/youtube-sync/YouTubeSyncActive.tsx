import { formatDistanceToNow } from "date-fns";
import { Play, RefreshCw, Loader2, ThumbsUp, History, Users, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPreviewCard } from "./VideoPreviewCard";
import type { YouTubeSyncConfig, YouTubeVideo } from "@/types/youtubeSync";

interface YouTubeSyncActiveProps {
  syncConfig: YouTubeSyncConfig;
  recentVideos: YouTubeVideo[];
  isSyncing: boolean;
  onSyncNow: () => void;
  onConfigure: () => void;
  onResetSync?: () => void;
}

export function YouTubeSyncActive({
  syncConfig,
  recentVideos,
  isSyncing,
  onSyncNow,
  onConfigure,
  onResetSync,
}: YouTubeSyncActiveProps) {
  const lastSyncText = syncConfig.lastSyncAt
    ? `Last synced ${formatDistanceToNow(new Date(syncConfig.lastSyncAt), { addSuffix: true })}`
    : "Never synced";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-red-500">{syncConfig.videosSyncedCount}</p>
          <p className="text-sm text-muted-foreground">Videos Synced</p>
        </div>
        <div className="bg-card rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-primary">{syncConfig.memoriesCreatedCount}</p>
          <p className="text-sm text-muted-foreground">Memories Created</p>
        </div>
      </div>

      {/* Last Sync */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">{lastSyncText}</span>
        <button
          onClick={onConfigure}
          className="text-sm text-primary hover:underline"
        >
          Edit settings
        </button>
      </div>

      {/* Current Settings Summary */}
      <div className="bg-card rounded-xl border p-4">
        <p className="text-sm font-medium mb-3">Syncing</p>
        <div className="flex flex-wrap gap-2">
          {syncConfig.syncLikedVideos && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-600 rounded-full text-xs font-medium">
              <ThumbsUp className="w-3 h-3" />
              Liked Videos
            </div>
          )}
          {syncConfig.syncWatchHistory && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-600 rounded-full text-xs font-medium">
              <History className="w-3 h-3" />
              Watch History
            </div>
          )}
          {syncConfig.syncSubscriptions && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-600 rounded-full text-xs font-medium">
              <Users className="w-3 h-3" />
              Subscriptions
            </div>
          )}
        </div>
      </div>

      {/* Recent Videos Preview */}
      {recentVideos.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Recent Videos</h3>
          <div className="grid grid-cols-2 gap-3">
            {recentVideos.slice(0, 4).map((video) => (
              <VideoPreviewCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
        >
          {isSyncing ? (
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

        {onResetSync && (
          <Button
            onClick={onResetSync}
            variant="outline"
            disabled={isSyncing}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset & Re-sync All Videos
          </Button>
        )}
      </div>
    </div>
  );
}
