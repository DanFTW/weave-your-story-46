import { Camera, RefreshCw, Image as ImageIcon, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SyncConfig, PhotoItem } from "@/types/googlePhotosSync";
import { PhotoPreviewCard } from "./PhotoPreviewCard";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface GooglePhotosSyncActiveProps {
  syncConfig: SyncConfig;
  recentPhotos: PhotoItem[];
  isSyncing: boolean;
  onSyncNow: () => void;
  onConfigure: () => void;
}

export function GooglePhotosSyncActive({
  syncConfig,
  recentPhotos,
  isSyncing,
  onSyncNow,
  onConfigure,
}: GooglePhotosSyncActiveProps) {
  const lastSyncFormatted = syncConfig.lastSyncAt 
    ? format(new Date(syncConfig.lastSyncAt), "MMM d, yyyy 'at' h:mm a")
    : 'Never';

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 rounded-2xl border border-teal-500/20 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Camera className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Sync Active</h3>
            <p className="text-xs text-muted-foreground">Monitoring Google Photos</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Photos Synced</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{syncConfig.photosSyncedCount}</p>
          </div>
          
          <div className="bg-background/60 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Memories</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{syncConfig.memoriesCreatedCount}</p>
          </div>
        </div>

        {/* Last Sync */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Last sync: {lastSyncFormatted}</span>
        </div>
      </div>

      {/* Recent Photos Grid */}
      {recentPhotos.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Recent Photos</h4>
          <div className="grid grid-cols-3 gap-2">
            {recentPhotos.slice(0, 6).map((photo) => (
              <PhotoPreviewCard key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={onSyncNow}
          disabled={isSyncing}
          className={cn(
            "w-full h-12 rounded-xl gap-2",
            "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600",
            "text-white shadow-lg shadow-teal-500/25"
          )}
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {isSyncing ? "Syncing..." : "Sync Now"}
        </Button>

        <Button
          variant="outline"
          onClick={onConfigure}
          className="w-full h-12 rounded-xl"
        >
          Configure Settings
        </Button>
      </div>
    </div>
  );
}
