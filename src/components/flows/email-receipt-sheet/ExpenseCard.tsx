import React, { useState } from "react";
import { Receipt, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ProcessedExpense } from "@/types/emailReceiptSheet";

interface ExpenseCardProps {
  expense: ProcessedExpense;
  onDelete?: (id: string) => Promise<void>;
}

export const ExpenseCard = React.forwardRef<HTMLDivElement, ExpenseCardProps>(
  ({ expense, onDelete }, ref) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDelete) return;
      setIsDeleting(true);
      try {
        await onDelete(expense.id);
      } finally {
        setIsDeleting(false);
      }
    };

    const timeAgo = formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true });

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">
                {expense.vendor || "Unknown vendor"}
              </p>
              <p className="text-xs text-muted-foreground">{timeAgo}</p>
            </div>
          </div>
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pl-12">
          {expense.amount && (
            <p className="text-base font-bold text-foreground">{expense.amount}</p>
          )}
          {expense.dateStr && (
            <p className="text-xs text-muted-foreground">{expense.dateStr}</p>
          )}
        </div>
      </div>
    );
  }
);

ExpenseCard.displayName = "ExpenseCard";
