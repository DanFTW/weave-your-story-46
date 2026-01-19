import { format } from "date-fns";
import { RefreshCw, Settings, Image, MessageCircle, Calendar, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstagramSyncConfig, InstagramPost } from "@/types/instagramSync";
import { PostPreviewCard } from "./PostPreviewCard";

interface InstagramSyncActiveProps {
  syncConfig: InstagramSyncConfig;
  recentPosts: InstagramPost[];
  isSyncing: boolean;
  onSyncNow: () => void;
  onConfigure: () => void;
  onResetSync?: () => void;
}

export function InstagramSyncActive({
  syncConfig,
  recentPosts,
  isSyncing,
  onSyncNow,
  onConfigure,
  onResetSync,
}: InstagramSyncActiveProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Image className="w-4 h-4 text-pink-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts Synced</span>
          </div>
          <p className="text-2xl font-bold">{syncConfig.postsSyncedCount}</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-pink-500" />
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

      {/* Sync Settings Summary */}
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Current Settings</h3>
          <button
            onClick={onConfigure}
            className="text-sm text-pink-500 hover:text-pink-600 flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sync Posts</span>
            <span className={syncConfig.syncPosts ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncPosts ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Sync Comments</span>
            <span className={syncConfig.syncComments ? "text-green-500" : "text-muted-foreground"}>
              {syncConfig.syncComments ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Posts Preview */}
      {recentPosts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Recent Posts
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {recentPosts.slice(0, 6).map((post) => (
              <PostPreviewCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSyncNow}
          disabled={isSyncing}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
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
