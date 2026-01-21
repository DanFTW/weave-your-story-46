import { useState } from "react";
import { Zap, Loader2, MessageSquare, Repeat2, Heart, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TwitterAutomationConfig, TwitterAutomationUpdatePayload } from "@/types/twitterAutomation";

interface AutomationConfigProps {
  config: TwitterAutomationConfig;
  onUpdateConfig: (updates: TwitterAutomationUpdatePayload) => Promise<boolean>;
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
    monitorReplies: config.monitorReplies,
    monitorRetweets: config.monitorRetweets,
    monitorLikes: config.monitorLikes,
  });

  const handleToggle = async (key: keyof typeof localConfig) => {
    const newValue = !localConfig[key];
    setLocalConfig(prev => ({ ...prev, [key]: newValue }));
    await onUpdateConfig({ [key]: newValue });
  };

  const isAnyEnabled = localConfig.monitorNewPosts || 
                       localConfig.monitorReplies || 
                       localConfig.monitorRetweets || 
                       localConfig.monitorLikes;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Real-Time Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Automatically capture Twitter activity
          </p>
        </div>
      </div>

      {/* Toggle Options */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PenLine className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">New Tweets</p>
              <p className="text-sm text-muted-foreground">Track your new posts</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorNewPosts}
            onCheckedChange={() => handleToggle('monitorNewPosts')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Replies</p>
              <p className="text-sm text-muted-foreground">Track your replies to others</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorReplies}
            onCheckedChange={() => handleToggle('monitorReplies')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Repeat2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Retweets</p>
              <p className="text-sm text-muted-foreground">Track content you share</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorRetweets}
            onCheckedChange={() => handleToggle('monitorRetweets')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Likes</p>
              <p className="text-sm text-muted-foreground">Track tweets you like</p>
            </div>
          </div>
          <Switch
            checked={localConfig.monitorLikes}
            onCheckedChange={() => handleToggle('monitorLikes')}
          />
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">
          Once activated, we'll automatically check for new activity every 5 minutes 
          and save it as memories. No manual syncing required!
        </p>
      </Card>

      {/* Warning if nothing enabled */}
      {!isAnyEnabled && (
        <p className="text-sm text-destructive text-center">
          Please enable at least one monitoring option
        </p>
      )}

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={!isAnyEnabled || isActivating}
        className="w-full"
        size="lg"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Activate Monitoring
          </>
        )}
      </Button>
    </div>
  );
}
