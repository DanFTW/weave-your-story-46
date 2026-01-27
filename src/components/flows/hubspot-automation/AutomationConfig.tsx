import { UserPlus, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { HubSpotAutomationConfig, HubSpotAutomationUpdatePayload } from "@/types/hubspotAutomation";

interface AutomationConfigProps {
  config: HubSpotAutomationConfig;
  onUpdateConfig: (updates: HubSpotAutomationUpdatePayload) => Promise<boolean>;
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({
  config,
  onUpdateConfig,
  onActivate,
  isActivating,
}: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FF7A59]/10 flex items-center justify-center flex-shrink-0">
            <UserPlus className="w-5 h-5 text-[#FF7A59]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Contact Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically save new HubSpot contacts as memories. When a contact is created in your CRM, we'll capture their details.
            </p>
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-foreground">New Contacts</p>
            <p className="text-sm text-muted-foreground">Save when contacts are created</p>
          </div>
          <Switch
            checked={config.monitorNewContacts}
            onCheckedChange={(checked) => onUpdateConfig({ monitorNewContacts: checked })}
          />
        </div>
      </div>

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={isActivating || !config.monitorNewContacts}
        className="w-full h-12 bg-[#FF7A59] hover:bg-[#FF7A59]/90 text-white"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          "Activate Monitoring"
        )}
      </Button>
    </div>
  );
}
