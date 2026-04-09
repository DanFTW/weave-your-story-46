import { useState, forwardRef } from "react";
import { ChevronDown, ChevronUp, Calendar, ExternalLink, Sparkles, Trash2, Loader2 } from "lucide-react";
import { FoundEvent } from "@/types/weeklyEventFinder";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FoundEventCardProps {
  event: FoundEvent;
  onDelete?: (id: string) => Promise<void>;
}

export const FoundEventCard = forwardRef<HTMLDivElement, FoundEventCardProps>(
  function FoundEventCard({ event, onDelete }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(event.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center gap-3 text-left hover:bg-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-sm truncate">
                {event.eventTitle || "Untitled Event"}
              </p>
              {event.eventDate && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {event.eventDate}
                </p>
              )}
            </div>
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            {event.eventDescription && (
              <p className="text-sm text-foreground/80 leading-relaxed">
                {event.eventDescription}
              </p>
            )}

            {event.eventReason && (
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {event.eventReason}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              {event.eventLink ? (
                <a
                  href={event.eventLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View event
                </a>
              ) : (
                <span />
              )}

              {onDelete && (
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
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
