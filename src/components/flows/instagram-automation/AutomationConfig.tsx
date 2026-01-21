import { useState } from "react";
import { Image, MessageCircle, Heart, Loader2, Zap, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstagramAutomationConfig, InstagramAutomationUpdatePayload } from "@/types/instagramAutomation";

interface AutomationConfigProps {
  config: InstagramAutomationConfig;
  onUpdateConfig: (updates: InstagramAutomationUpdatePayload) => Promise<boolean>;
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({
  config,
  onUpdateConfig,
  onActivate,
  isActivating,
}: AutomationConfigProps) {
  const [localConfig, setLocalConfig] = useState({
    monitorNewPosts: config.monitorNewPosts,
    monitorComments: config.monitorComments,
    monitorLikes: config.monitorLikes,
  });

  const handleToggle = async (key: keyof typeof localConfig, value: boolean) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    await onUpdateConfig({ [key]: value });
  };

  const hasAnyMonitoring = localConfig.monitorNewPosts || localConfig.monitorComments || localConfig.monitorLikes;

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Always-On Monitoring</h2>
        <p className="text-sm text-muted-foreground">
          Automatically create memories when activity happens on your Instagram account
        </p>
      </div>

      {/* Monitoring options */}
      <Card className="p-4 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Track Activity
        </h3>

        {/* New Posts */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <Image className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">New Posts</p>
              <p className="text-sm text-muted-foreground">When you share new content</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorNewPosts}
            onCheckedChange={(checked) => handleToggle('monitorNewPosts', checked)}
          />
        </div>

        {/* Comments */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">New Comments</p>
              <p className="text-sm text-muted-foreground">Comments on your posts</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorComments}
            onCheckedChange={(checked) => handleToggle('monitorComments', checked)}
          />
        </div>

        {/* Likes */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Engagement Growth</p>
              <p className="text-sm text-muted-foreground">Track significant like milestones</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorLikes}
            onCheckedChange={(checked) => handleToggle('monitorLikes', checked)}
          />
        </div>
      </Card>

      {/* Automatic sync info */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Automatic Sync</p>
            <p className="text-sm text-muted-foreground">
              Once activated, we'll automatically check your Instagram every 5 minutes and create memories for new activity. No manual action needed!
            </p>
          </div>
        </div>
      </Card>

      {/* Warning if nothing selected */}
      {!hasAnyMonitoring && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Enable at least one activity type to activate monitoring
        </p>
      )}

      {/* Activate button */}
      <Button
        onClick={onActivate}
        disabled={!hasAnyMonitoring || isActivating}
        className="w-full h-14 text-base font-semibold bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Start Monitoring
          </>
        )}
      </Button>
    </div>
  );
}
