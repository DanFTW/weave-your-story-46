import { useState } from "react";
import { UserPlus, Loader2, Zap, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { 
  LinkedInAutomationConfig, 
  LinkedInAutomationUpdatePayload 
} from "@/types/linkedinAutomation";

interface AutomationConfigProps {
  config: LinkedInAutomationConfig;
  onUpdateConfig: (updates: LinkedInAutomationUpdatePayload) => Promise<boolean>;
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
    monitorNewConnections: config.monitorNewConnections,
  });

  const handleToggle = async (key: keyof typeof localConfig, value: boolean) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
    await onUpdateConfig({ [key]: value } as LinkedInAutomationUpdatePayload);
  };

  const isEnabled = localConfig.monitorNewConnections;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-[#0A66C2]" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Configure Monitoring</h3>
          <p className="text-sm text-muted-foreground">Choose what to track on LinkedIn</p>
        </div>
      </div>

      {/* Toggle Options */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-medium text-foreground">New Connections</p>
            <p className="text-sm text-muted-foreground">
              Save new LinkedIn contacts as memories
            </p>
          </div>
          <Switch
            checked={localConfig.monitorNewConnections}
            onCheckedChange={(checked) => handleToggle('monitorNewConnections', checked)}
          />
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              When you add a new connection on LinkedIn, we'll automatically save their full profile 
              as a memory — including their name, headline, company, and location.
            </p>
          </div>
        </div>
      </Card>

      {/* Warning if nothing enabled */}
      {!isEnabled && (
        <p className="text-sm text-amber-500 text-center">
          Enable at least one monitoring option to activate
        </p>
      )}

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={!isEnabled || isActivating}
        className="w-full h-12 bg-[#0A66C2] hover:bg-[#004182] text-white"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Activate Monitoring
          </>
        )}
      </Button>
    </div>
  );
}
