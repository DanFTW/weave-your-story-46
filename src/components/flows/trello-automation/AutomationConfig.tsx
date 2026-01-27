import { PlusCircle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TrelloAutomationConfig } from "@/types/trelloAutomation";

interface AutomationConfigProps {
  config: TrelloAutomationConfig;
  onUpdateOptions: (options: { monitorNewCards?: boolean; monitorCompletedCards?: boolean }) => Promise<void>;
  onActivate: () => Promise<void>;
  isLoading: boolean;
}

export function AutomationConfig({ config, onUpdateOptions, onActivate, isLoading }: AutomationConfigProps) {
  const canActivate = config.monitorNewCards || config.monitorCompletedCards;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-medium text-foreground mb-2">Board Configuration</h3>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Board: <span className="text-foreground font-medium">{config.boardName}</span>
          </p>
          <p className="text-muted-foreground">
            Done List: <span className="text-foreground font-medium">{config.doneListName}</span>
          </p>
        </div>
      </div>

      {/* Monitoring Options */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground">What to Monitor</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <PlusCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">New Cards</p>
                <p className="text-sm text-muted-foreground">Save when tasks are created</p>
              </div>
            </div>
            <Switch
              checked={config.monitorNewCards}
              onCheckedChange={(checked) => onUpdateOptions({ monitorNewCards: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">Completed Cards</p>
                <p className="text-sm text-muted-foreground">Save when tasks are done</p>
              </div>
            </div>
            <Switch
              checked={config.monitorCompletedCards}
              onCheckedChange={(checked) => onUpdateOptions({ monitorCompletedCards: checked })}
            />
          </div>
        </div>
      </div>

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={!canActivate || isLoading}
        className="w-full h-14 text-lg rounded-xl bg-[#0052CC] hover:bg-[#0052CC]/90"
      >
        <Zap className="w-5 h-5 mr-2" />
        Activate Monitoring
      </Button>

      {!canActivate && (
        <p className="text-center text-sm text-muted-foreground">
          Enable at least one monitoring option to activate.
        </p>
      )}
    </div>
  );
}
