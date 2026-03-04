import { useState } from "react";
import { ChevronDown, ChevronUp, X, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PendingCalendarEvent } from "@/types/calendarEventSync";

interface PendingEventCardProps {
  event: PendingCalendarEvent;
  onUpdate: (eventId: string, fields: { eventTitle?: string; eventDate?: string; eventTime?: string; eventDescription?: string }) => Promise<void>;
  onPush: (eventId: string) => Promise<boolean>;
  onDismiss: (eventId: string) => Promise<void>;
  isPushing: boolean;
}

export function PendingEventCard({ event, onUpdate, onPush, onDismiss, isPushing }: PendingEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(event.eventTitle ?? "");
  const [date, setDate] = useState(event.eventDate ?? "");
  const [time, setTime] = useState(event.eventTime ?? "");
  const [description, setDescription] = useState(event.eventDescription ?? "");

  const isComplete = title.trim().length > 0 && date.trim().length > 0;

  const handleSaveAndPush = async () => {
    // Save any edits first
    await onUpdate(event.id, {
      eventTitle: title.trim(),
      eventDate: date.trim(),
      eventTime: time.trim() || undefined,
      eventDescription: description.trim() || undefined,
    });
    await onPush(event.id);
  };

  const missingFields: string[] = [];
  if (!title.trim()) missingFields.push("title");
  if (!date.trim()) missingFields.push("date");

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {event.eventTitle || "Untitled Event"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {event.memoryContent.length > 80
              ? event.memoryContent.slice(0, 80) + "…"
              : event.memoryContent}
          </p>
          {missingFields.length > 0 && (
            <p className="text-xs text-destructive mt-1">
              Missing: {missingFields.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(event.id); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Event Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Team dinner"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date *</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Time</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 rounded-xl text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <button
            onClick={handleSaveAndPush}
            disabled={!isComplete || isPushing}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          >
            {isPushing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Push to Calendar
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
