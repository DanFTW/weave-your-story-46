import { useState } from "react";
import { MessageSquare, Repeat2, Heart, Loader2, ArrowRight, PenLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface TwitterSyncConfigProps {
  syncTweets: boolean;
  syncRetweets: boolean;
  syncReplies: boolean;
  syncLikes: boolean;
  isSaving: boolean;
  onSave: (config: { 
    syncTweets: boolean; 
    syncRetweets: boolean; 
    syncReplies: boolean; 
    syncLikes: boolean;
  }) => Promise<void>;
  onStartSync: () => void;
}

export function TwitterSyncConfig({
  syncTweets: initialSyncTweets,
  syncRetweets: initialSyncRetweets,
  syncReplies: initialSyncReplies,
  syncLikes: initialSyncLikes,
  isSaving,
  onSave,
  onStartSync,
}: TwitterSyncConfigProps) {
  const [syncTweets, setSyncTweets] = useState(initialSyncTweets);
  const [syncRetweets, setSyncRetweets] = useState(initialSyncRetweets);
  const [syncReplies, setSyncReplies] = useState(initialSyncReplies);
  const [syncLikes, setSyncLikes] = useState(initialSyncLikes);

  const handleSaveAndSync = async () => {
    await onSave({ syncTweets, syncRetweets, syncReplies, syncLikes });
    onStartSync();
  };

  const isAnyEnabled = syncTweets || syncRetweets || syncReplies || syncLikes;

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          Choose what content to sync from your Twitter/X account. Your tweets, retweets, 
          replies, and likes will be saved as searchable memories.
        </p>
      </div>

      {/* Config Options */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Sync Options
        </h3>

        {/* Sync Tweets */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900/10 dark:bg-white/10 flex items-center justify-center">
              <PenLine className="w-5 h-5 text-gray-900 dark:text-white" />
            </div>
            <div>
              <p className="font-medium">Sync Tweets</p>
              <p className="text-sm text-muted-foreground">Save your original posts as memories</p>
            </div>
          </div>
          <Switch
            checked={syncTweets}
            onCheckedChange={setSyncTweets}
          />
        </div>

        {/* Sync Retweets */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900/10 dark:bg-white/10 flex items-center justify-center">
              <Repeat2 className="w-5 h-5 text-gray-900 dark:text-white" />
            </div>
            <div>
              <p className="font-medium">Sync Retweets</p>
              <p className="text-sm text-muted-foreground">Include posts you've retweeted</p>
            </div>
          </div>
          <Switch
            checked={syncRetweets}
            onCheckedChange={setSyncRetweets}
          />
        </div>

        {/* Sync Replies */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900/10 dark:bg-white/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-gray-900 dark:text-white" />
            </div>
            <div>
              <p className="font-medium">Sync Replies</p>
              <p className="text-sm text-muted-foreground">Include your replies to others</p>
            </div>
          </div>
          <Switch
            checked={syncReplies}
            onCheckedChange={setSyncReplies}
          />
        </div>

        {/* Sync Likes */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900/10 dark:bg-white/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-gray-900 dark:text-white" />
            </div>
            <div>
              <p className="font-medium">Sync Likes</p>
              <p className="text-sm text-muted-foreground">Save posts you've liked</p>
            </div>
          </div>
          <Switch
            checked={syncLikes}
            onCheckedChange={setSyncLikes}
          />
        </div>
      </div>

      {/* Developer Access Note */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          <strong>Note:</strong> Twitter API access depends on your account's API access level. 
          Some features may be limited based on your developer account tier.
        </p>
      </div>

      {/* Start Sync Button */}
      <Button
        onClick={handleSaveAndSync}
        disabled={isSaving || !isAnyEnabled}
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-gray-900 to-black hover:from-gray-800 hover:to-gray-900 text-white"
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
