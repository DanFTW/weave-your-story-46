import { useState } from "react";
import { Receipt, FileSpreadsheet, Pause, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmailReceiptSheetStats, ProcessedExpense } from "@/types/emailReceiptSheet";
import { ExpenseCard } from "./ExpenseCard";

interface ActiveMonitoringProps {
  stats: EmailReceiptSheetStats;
  sheetName: string;
  expenses: ProcessedExpense[];
  onPause: () => Promise<boolean>;
  onManualSync: () => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  isSyncing: boolean;
}

export function ActiveMonitoring({
  stats,
  sheetName,
  expenses,
  onPause,
  onManualSync,
  onDeleteExpense,
  isSyncing,
}: ActiveMonitoringProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
              <h3 className="font-semibold text-foreground text-base">Expense Tracking</h3>
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

      {/* Target sheet */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Posting to</p>
          <p className="text-base font-semibold text-foreground truncate">{sheetName}</p>
        </div>
      </div>

      {/* Collapsible expense history */}
      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-2xl font-bold text-foreground">{stats.rowsPosted}</p>
              <p className="text-sm text-muted-foreground">Expenses tracked</p>
            </div>
            {isHistoryOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No expenses tracked yet
            </p>
          ) : (
            expenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onDelete={onDeleteExpense}
              />
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Sync now button */}
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
            Scan recent emails for receipts
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause expense tracking
      </button>
    </div>
  );
}
