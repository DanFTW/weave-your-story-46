import { CheckSquare, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TodoistTaskStats } from "@/types/todoistAutomation";

interface ActiveMonitoringProps {
  stats: TodoistTaskStats;
  onPause: () => void;
}

export function ActiveMonitoring({ stats, onPause }: ActiveMonitoringProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monitoring Active</h3>
            <p className="text-sm text-muted-foreground">Tracking new Todoist tasks in real-time</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.tasksTracked}</div>
            <div className="text-xs text-muted-foreground mt-1">Tasks Tracked</div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">Monitoring</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-lg bg-[#E44332]/10 flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-[#E44332]" />
          </div>
          <span className="text-foreground">New Tasks</span>
          <span className="ml-auto text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      <Button variant="outline" onClick={onPause} className="w-full">
        <Pause className="w-4 h-4 mr-2" />
        Pause
      </Button>
    </div>
  );
}
