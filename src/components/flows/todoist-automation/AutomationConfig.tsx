import { CheckSquare, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { TodoistAutomationConfig, TodoistAutomationUpdatePayload } from "@/types/todoistAutomation";

interface AutomationConfigProps {
  config: TodoistAutomationConfig;
  onUpdateConfig: (updates: TodoistAutomationUpdatePayload) => Promise<boolean>;
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({ config, onUpdateConfig, onActivate, isActivating }: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#E44332]/10 flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-5 h-5 text-[#E44332]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Task Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically save new Todoist tasks as memories. When a task is created, we'll capture its details in real-time.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-foreground">New Tasks</p>
            <p className="text-sm text-muted-foreground">Save when tasks are created</p>
          </div>
          <Switch
            checked={config.monitorNewTasks}
            onCheckedChange={(checked) => onUpdateConfig({ monitorNewTasks: checked })}
          />
        </div>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating || !config.monitorNewTasks}
        className="w-full h-12 bg-[#E44332] hover:bg-[#E44332]/90 text-white"
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
