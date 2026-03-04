import { Calendar, CalendarCheck, Pause, RefreshCw, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CalendarEventSyncStats, PendingCalendarEvent } from "@/types/calendarEventSync";
import { PendingEventCard } from "./PendingEventCard";

interface ActiveMonitoringProps {
  stats: CalendarEventSyncStats;
  pendingEvents: PendingCalendarEvent[];
  onPause: () => Promise<boolean>;
  onUpdateEvent: (eventId: string, fields: { eventTitle?: string; eventDate?: string; eventTime?: string; eventDescription?: string }) => Promise<void>;
  onPushToCalendar: (eventId: string) => Promise<boolean>;
  onDismiss: (eventId: string) => Promise<void>;
  isPushing: string | null;
  onManualSync?: () => Promise<void>;
  isSyncing?: boolean;
}

export function ActiveMonitoring({
  stats,
  pendingEvents,
  onPause,
  onUpdateEvent,
  onPushToCalendar,
  onDismiss,
  isPushing,
  onManualSync,
  isSyncing = false,
}: ActiveMonitoringProps) {
  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Auto-sync</h3>
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

      {/* Stats */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.eventsCreated}</p>
          <p className="text-sm text-muted-foreground">Events created</p>
        </div>
      </div>

      {/* Sync now button */}
      {onManualSync && (
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
              Scan existing memories for events
            </p>
          </div>
        </button>
      )}

      {/* Pending queue */}
      {pendingEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Needs your input ({pendingEvents.length})
          </h3>
          {pendingEvents.map((event) => (
            <PendingEventCard
              key={event.id}
              event={event}
              onUpdate={onUpdateEvent}
              onPush={onPushToCalendar}
              onDismiss={onDismiss}
              isPushing={isPushing === event.id}
            />
          ))}
        </div>
      )}

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause calendar sync
      </button>
    </div>
  );
}
