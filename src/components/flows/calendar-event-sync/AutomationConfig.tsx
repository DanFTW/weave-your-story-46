import { Calendar, ArrowRight } from "lucide-react";
import { CalendarEventSyncConfig } from "@/types/calendarEventSync";

interface AutomationConfigProps {
  config: CalendarEventSyncConfig;
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({ config, onActivate, isActivating }: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      {/* Explanation card */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">How it works</h3>
            <p className="text-muted-foreground text-sm">Memories → Calendar events</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            "When you save a memory, we parse it for event details",
            "Complete events (title + date) create a Google Calendar event automatically",
            "Incomplete events land in a queue for you to fill in missing info",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Activate button */}
      <button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
      >
        {isActivating ? (
          <span className="animate-pulse">Activating...</span>
        ) : (
          <>
            Enable Calendar Sync
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
