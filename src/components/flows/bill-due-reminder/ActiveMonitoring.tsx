import { useState } from "react";
import { Receipt, Pause, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BillDueReminderStats, ProcessedBill } from "@/types/billDueReminder";
import { BillCard } from "./BillCard";

interface ActiveMonitoringProps {
  stats: BillDueReminderStats;
  bills: ProcessedBill[];
  onPause: () => Promise<boolean>;
  onManualSync: () => Promise<void>;
  onDeleteBill: (id: string) => Promise<void>;
  isSyncing: boolean;
}

export function ActiveMonitoring({ stats, bills, onPause, onManualSync, onDeleteBill, isSyncing }: ActiveMonitoringProps) {
  const [billsOpen, setBillsOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Bill Scanner</h3>
              <p className="text-muted-foreground text-sm">
                {stats.isActive ? "Active" : "Paused"}
              </p>
            </div>
          </div>
          <Switch
            checked={stats.isActive}
            onCheckedChange={(checked) => {
              if (!checked) onPause();
            }}
          />
        </div>
      </div>

      {/* Bills history — collapsible */}
      <Collapsible open={billsOpen} onOpenChange={setBillsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-foreground text-base">Bills found</p>
              <p className="text-sm text-muted-foreground">{stats.billsFound} bill{stats.billsFound !== 1 ? "s" : ""}</p>
            </div>
            {billsOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            {bills.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bills found yet. Run a sync to scan your Gmail.
              </p>
            ) : (
              bills.map((bill) => (
                <BillCard key={bill.id} bill={bill} onDelete={onDeleteBill} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sync now */}
      <button
        onClick={onManualSync}
        disabled={isSyncing}
        className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/50 transition-colors disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground text-base">
            {isSyncing ? "Syncing…" : "Sync now"}
          </p>
          <p className="text-sm text-muted-foreground">
            Scan recent emails for bills
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause bill scanner
      </button>
    </div>
  );
}
