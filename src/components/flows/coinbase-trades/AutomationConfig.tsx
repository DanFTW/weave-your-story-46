import { ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AutomationConfigProps {
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({ onActivate, isActivating }: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0052FF]/10 flex items-center justify-center flex-shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-[#0052FF]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Trade Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically save all Coinbase trades as memories. On first activation, a full historical backfill is performed. Subsequent runs only fetch new trades.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-2">What gets tracked</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            All trading pairs (BTC-USD, ETH-USD, etc.)
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            Buy and sell trades with price &amp; size
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" />
            Deduplicated — each trade saved only once
          </li>
        </ul>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-12 bg-[#0052FF] hover:bg-[#0052FF]/90 text-white"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          "Activate Trade Monitoring"
        )}
      </Button>
    </div>
  );
}
