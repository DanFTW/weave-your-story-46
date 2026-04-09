import { useState, forwardRef } from "react";
import { Receipt, Trash2, Loader2 } from "lucide-react";
import { ProcessedBill } from "@/types/billDueReminder";
import { formatDistanceToNow } from "date-fns";

interface BillCardProps {
  bill: ProcessedBill;
  onDelete?: (id: string) => Promise<void>;
}

export const BillCard = forwardRef<HTMLDivElement, BillCardProps>(
  function BillCard({ bill, onDelete }, ref) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDelete || isDeleting) return;
      setIsDeleting(true);
      try {
        await onDelete(bill.id);
      } finally {
        setIsDeleting(false);
      }
    };

    const timeAgo = formatDistanceToNow(new Date(bill.createdAt), { addSuffix: true });

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm truncate">
              {bill.billerName || bill.subject || "Bill"}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {timeAgo}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {bill.amountDue && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Amount:</span>
              <span className="text-sm font-semibold text-foreground">{bill.amountDue}</span>
            </div>
          )}
          {bill.dueDate && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Due:</span>
              <span className="text-sm text-foreground/80">{bill.dueDate}</span>
            </div>
          )}
        </div>

        {bill.subject && bill.billerName && (
          <p className="text-sm text-foreground/60 truncate">{bill.subject}</p>
        )}

        {onDelete && (
          <div className="flex items-center justify-end">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 text-sm text-destructive font-medium hover:underline disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }
);
