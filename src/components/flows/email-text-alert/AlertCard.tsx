import { useState, forwardRef } from "react";
import { Mail, Trash2, Loader2 } from "lucide-react";
import { ProcessedAlert } from "@/types/emailTextAlert";
import { formatDistanceToNow } from "date-fns";

interface AlertCardProps {
  alert: ProcessedAlert;
  onDelete?: (id: string) => Promise<void>;
}

export const AlertCard = forwardRef<HTMLDivElement, AlertCardProps>(
  function AlertCard({ alert, onDelete }, ref) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onDelete || isDeleting) return;
      setIsDeleting(true);
      try {
        await onDelete(alert.id);
      } finally {
        setIsDeleting(false);
      }
    };

    const timeAgo = formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true });

    return (
      <div ref={ref} className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-sm truncate">
              {alert.subject || alert.senderEmail || "Email Alert"}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {timeAgo}
            </p>
          </div>
        </div>

        {alert.senderEmail && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">From:</span>
            <span className="text-sm text-foreground/80 truncate">{alert.senderEmail}</span>
          </div>
        )}

        {alert.summary && (
          <p className="text-sm text-foreground/80 leading-relaxed">
            {alert.summary}
          </p>
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
