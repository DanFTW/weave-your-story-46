import { ArrowRightLeft, Pause, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoinbaseTradesStats } from "@/types/coinbaseTradesAutomation";
import { formatDistanceToNow } from "date-fns";

interface ActiveMonitoringProps {
  stats: CoinbaseTradesStats;
  onPause: () => void;
  onCheckNow: () => void;
  isPolling?: boolean;
}

export function ActiveMonitoring({ stats, onPause, onCheckNow, isPolling }: ActiveMonitoringProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monitoring Active</h3>
            <p className="text-sm text-muted-foreground">
              {stats.lastPolledAt
                ? `Last checked ${formatDistanceToNow(new Date(stats.lastPolledAt), { addSuffix: true })}`
                : "Tracking Coinbase trades"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.tradesTracked}</div>
            <div className="text-xs text-muted-foreground mt-1">Trades Tracked</div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">Monitoring</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-lg bg-[#0052FF]/10 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-[#0052FF]" />
          </div>
          <span className="text-foreground">All Trades</span>
          <span className="ml-auto text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCheckNow} disabled={isPolling} className="flex-1">
          <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
          {isPolling ? 'Checking...' : 'Check Now'}
        </Button>
        <Button variant="outline" onClick={onPause} className="flex-1">
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      </div>
    </div>
  );
}
