import { ChevronLeft, PlusCircle, CheckCircle2, Pause, RotateCcw, Layout } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrelloAutomationStats } from "@/types/trelloAutomation";
import { cn } from "@/lib/utils";

interface ActiveMonitoringProps {
  stats: TrelloAutomationStats;
  boardName: string;
  doneListName: string;
  onPause: () => Promise<void>;
  onReset: () => Promise<void>;
  isLoading: boolean;
}

export function ActiveMonitoring({ 
  stats, 
  boardName, 
  doneListName, 
  onPause, 
  onReset,
  isLoading 
}: ActiveMonitoringProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-blue")}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/threads')}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white truncate">Trello Task Tracker</h1>
            <p className="text-white/70 text-sm truncate">Monitoring active</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-white text-sm font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5 space-y-6">
        {/* Board Info */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#0052CC] flex items-center justify-center">
              <Layout className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-foreground">{boardName}</p>
              <p className="text-sm text-muted-foreground">Done list: {doneListName}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <PlusCircle className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground">New Tasks</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.cardsTracked}</p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{stats.completedTracked}</p>
          </div>
        </div>

        {/* How it works */}
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <h3 className="font-medium text-foreground mb-2">How it works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <PlusCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>When a new card is created on your board, it's saved as a "New Task" memory.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>When a card is moved to "{doneListName}", it's saved as a "Completed Task" memory.</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={onPause}
            disabled={isLoading}
            className="w-full h-12"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Monitoring
          </Button>

          <Button
            variant="ghost"
            onClick={onReset}
            disabled={isLoading}
            className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}
