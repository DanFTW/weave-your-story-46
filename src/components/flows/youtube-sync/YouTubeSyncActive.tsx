import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Loader2, ThumbsUp, History, Users, RotateCcw, ChevronDown, ChevronUp, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VideoPreviewCard } from "./VideoPreviewCard";
import type { YouTubeSyncConfig, YouTubeVideo } from "@/types/youtubeSync";
import type { SyncHistoryItem } from "@/hooks/useYouTubeSync";

interface YouTubeSyncActiveProps {
  syncConfig: YouTubeSyncConfig;
  recentVideos: YouTubeVideo[];
  syncHistory: SyncHistoryItem[];
  isSyncing: boolean;
  onSyncNow: () => void;
  onConfigure: () => void;
  onResetSync?: () => void;
}

const categoryConfig: Record<string, { icon: typeof ThumbsUp; colorClass: string }> = {
  "Liked Video": { icon: ThumbsUp, colorClass: "bg-red-500/10 text-red-600" },
  "Watch History": { icon: History, colorClass: "bg-orange-500/10 text-orange-600" },
  "Subscription": { icon: Users, colorClass: "bg-purple-500/10 text-purple-600" },
};

export function YouTubeSyncActive({
  syncConfig,
  recentVideos,
  syncHistory,
  isSyncing,
  onSyncNow,
  onConfigure,
  onResetSync,
}: YouTubeSyncActiveProps) {
  const [historyOpen, setHistoryOpen] = useState(true);

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

      {/* Sync History */}
      {syncHistory.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium mb-2">
            <span>Sync History ({syncHistory.length})</span>
            {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {syncHistory.map((item) => {
                const cat = categoryConfig[item.videoCategory || "Liked Video"] || categoryConfig["Liked Video"];
                const CatIcon = cat.icon;
                return (
                  <div key={item.id} className="bg-card rounded-xl border p-3 flex items-start gap-3">
                    <div className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${cat.colorClass}`}>
                      <CatIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.videoTitle || item.youtubeVideoId}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.colorClass}`}>
                          {item.videoCategory || "Liked Video"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.syncedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

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
