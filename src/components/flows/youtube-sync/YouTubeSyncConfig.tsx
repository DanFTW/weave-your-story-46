import { useState } from "react";
import { Loader2, Play, ThumbsUp, History, Users, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface YouTubeSyncConfigProps {
  syncLikedVideos: boolean;
  syncWatchHistory: boolean;
  syncSubscriptions: boolean;
  isSaving: boolean;
  onSave: (config: {
    syncLikedVideos: boolean;
    syncWatchHistory: boolean;
    syncSubscriptions: boolean;
  }) => Promise<void>;
  onStartSync: () => void;
}

export function YouTubeSyncConfig({
  syncLikedVideos: initialSyncLikedVideos,
  syncWatchHistory: initialSyncWatchHistory,
  syncSubscriptions: initialSyncSubscriptions,
  isSaving,
  onSave,
  onStartSync,
}: YouTubeSyncConfigProps) {
  const [syncLikedVideos, setSyncLikedVideos] = useState(initialSyncLikedVideos);
  const [syncWatchHistory, setSyncWatchHistory] = useState(initialSyncWatchHistory);
  const [syncSubscriptions, setSyncSubscriptions] = useState(initialSyncSubscriptions);

  const handleSaveAndSync = async () => {
    await onSave({
      syncLikedVideos,
      syncWatchHistory,
      syncSubscriptions,
    });
    onStartSync();
  };

  const hasAnySelected = syncLikedVideos || syncWatchHistory || syncSubscriptions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">What would you like to sync?</h2>
        <p className="text-muted-foreground text-sm">
          Select the types of YouTube content to save as memories.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-4">
        {/* Liked Videos */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <ThumbsUp className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium">Liked Videos</p>
              <p className="text-sm text-muted-foreground">Videos you've liked</p>
            </div>
          </div>
          <Switch
            checked={syncLikedVideos}
            onCheckedChange={setSyncLikedVideos}
          />
        </div>

        {/* Watch History */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <History className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="font-medium">Watch History</p>
              <p className="text-sm text-muted-foreground">Recently watched videos</p>
            </div>
          </div>
          <Switch
            checked={syncWatchHistory}
            onCheckedChange={setSyncWatchHistory}
          />
        </div>

        {/* Subscriptions */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium">Subscriptions</p>
              <p className="text-sm text-muted-foreground">Channels you follow</p>
            </div>
          </div>
          <Switch
            checked={syncSubscriptions}
            onCheckedChange={setSyncSubscriptions}
          />
        </div>
      </div>

      {/* Note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
        <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          YouTube API access may be limited based on your account permissions. 
          Some content may not be available for syncing.
        </p>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleSaveAndSync}
        disabled={isSaving || !hasAnySelected}
        className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2 fill-current" />
            Start Sync
          </>
        )}
      </Button>
    </div>
  );
}
