import { useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface GooglePhotosSyncConfigProps {
  syncNewPhotos: boolean;
  autoCreateMemories: boolean;
  isSaving: boolean;
  onSave: (config: { syncNewPhotos: boolean; autoCreateMemories: boolean }) => Promise<void>;
  onStartSync: () => void;
}

export function GooglePhotosSyncConfig({
  syncNewPhotos: initialSyncNewPhotos,
  autoCreateMemories: initialAutoCreateMemories,
  isSaving,
  onSave,
  onStartSync,
}: GooglePhotosSyncConfigProps) {
  const [syncNewPhotos, setSyncNewPhotos] = useState(initialSyncNewPhotos);
  const [autoCreateMemories, setAutoCreateMemories] = useState(initialAutoCreateMemories);

  const handleSaveAndSync = async () => {
    await onSave({ syncNewPhotos, autoCreateMemories });
    onStartSync();
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="text-center px-4 py-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Configure Photo Sync
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose how you want your Google Photos synced as memories.
        </p>
      </div>

      {/* Settings */}
      <div className="space-y-4 bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Sync New Photos</Label>
            <p className="text-xs text-muted-foreground">
              Automatically detect new photos
            </p>
          </div>
          <Switch
            checked={syncNewPhotos}
            onCheckedChange={setSyncNewPhotos}
          />
        </div>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Auto-create Memories</Label>
            <p className="text-xs text-muted-foreground">
              Create memories automatically when syncing
            </p>
          </div>
          <Switch
            checked={autoCreateMemories}
            onCheckedChange={setAutoCreateMemories}
          />
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-xs text-muted-foreground text-center">
          Photos will be saved with AI-generated descriptions. 
          You can edit or delete any memory after syncing.
        </p>
      </div>

      {/* Start Sync Button */}
      <Button
        onClick={handleSaveAndSync}
        disabled={isSaving}
        className={cn(
          "w-full h-14 rounded-2xl text-base font-semibold gap-2",
          "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600",
          "text-white shadow-lg shadow-teal-500/25"
        )}
      >
        {isSaving ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
        Start Syncing Photos
      </Button>
    </div>
  );
}
