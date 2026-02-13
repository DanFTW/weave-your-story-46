import { MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DiscordAutomationConfig } from "@/types/discordAutomation";
import { useState } from "react";

interface AutomationConfigProps {
  config: DiscordAutomationConfig;
  onActivate: () => Promise<void>;
  isLoading: boolean;
}

export function AutomationConfig({ config, onActivate, isLoading }: AutomationConfigProps) {
  const [monitorMessages, setMonitorMessages] = useState(true);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-medium text-foreground mb-2">Channel Configuration</h3>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Server: <span className="text-foreground font-medium">{config.serverName}</span>
          </p>
          <p className="text-muted-foreground">
            Channel: <span className="text-foreground font-medium">#{config.channelName}</span>
          </p>
        </div>
      </div>

      {/* Toggle */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5865F2]/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
            </div>
            <div>
              <p className="font-medium text-foreground">New Messages</p>
              <p className="text-sm text-muted-foreground">Save when messages are posted</p>
            </div>
          </div>
          <Switch checked={monitorMessages} onCheckedChange={setMonitorMessages} />
        </div>
      </div>

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={!monitorMessages || isLoading}
        className="w-full h-14 text-lg rounded-xl bg-[#5865F2] hover:bg-[#5865F2]/90"
      >
        <Zap className="w-5 h-5 mr-2" />
        Activate Monitoring
      </Button>
    </div>
  );
}
