import { useState } from "react";
import { Image, MessageCircle, Loader2, ArrowRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface InstagramSyncConfigProps {
  syncPosts: boolean;
  syncComments: boolean;
  isSaving: boolean;
  onSave: (config: { syncPosts: boolean; syncComments: boolean }) => Promise<void>;
  onStartSync: () => void;
}

export function InstagramSyncConfig({
  syncPosts: initialSyncPosts,
  syncComments: initialSyncComments,
  isSaving,
  onSave,
  onStartSync,
}: InstagramSyncConfigProps) {
  const [syncPosts, setSyncPosts] = useState(initialSyncPosts);
  const [syncComments, setSyncComments] = useState(initialSyncComments);

  const handleSaveAndSync = async () => {
    await onSave({ syncPosts, syncComments });
    onStartSync();
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          Choose what content to sync from your Instagram account. Your posts and comments 
          will be saved as searchable memories.
        </p>
      </div>

      {/* Config Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Sync Options
        </h3>

        {/* Sync Posts */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Image className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <p className="font-medium">Sync Posts</p>
              <p className="text-sm text-muted-foreground">Save your photo posts as memories</p>
            </div>
          </div>
          <Switch
            checked={syncPosts}
            onCheckedChange={setSyncPosts}
          />
        </div>

        {/* Sync Comments */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-pink-500" />
            </div>
            <div>
              <p className="font-medium">Sync Comments</p>
              <p className="text-sm text-muted-foreground">Include your comments on posts</p>
            </div>
          </div>
          <Switch
            checked={syncComments}
            onCheckedChange={setSyncComments}
          />
        </div>
      </div>

      {/* Professional Account Note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          <strong>Note:</strong> Instagram API requires a Professional (Business or Creator) account. 
          If you have a personal account, you can convert it for free in your Instagram settings.
        </p>
      </div>

      {/* Start Sync Button */}
      <Button
        onClick={handleSaveAndSync}
        disabled={isSaving || (!syncPosts && !syncComments)}
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
      >
        {isSaving ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            Start Sync
            <ArrowRight className="w-5 h-5 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
