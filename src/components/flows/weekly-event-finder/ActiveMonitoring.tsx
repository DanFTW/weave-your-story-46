import { useState } from "react";
import { Heart, MapPin, Clock, Mail, Phone, Pause, RefreshCw, Loader2, Calendar, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { parseAndDeduplicateInterestTags } from "@/utils/interestTagUtils";
import { Switch } from "@/components/ui/switch";
import { WeeklyEventFinderStats, WeeklyEventFinderConfig, FoundEvent } from "@/types/weeklyEventFinder";
import { FoundEventCard } from "./FoundEventCard";

interface ActiveMonitoringProps {
  stats: WeeklyEventFinderStats;
  config: WeeklyEventFinderConfig;
  events: FoundEvent[];
  onPause: () => Promise<boolean>;
  onManualSync: () => Promise<void>;
  isSyncing: boolean;
  onSyncInterests: () => Promise<void>;
  isSyncingInterests: boolean;
  onDeleteEvent: (id: string) => Promise<void>;
}

export function ActiveMonitoring({ stats, config, events, onPause, onManualSync, isSyncing, onSyncInterests, isSyncingInterests, onDeleteEvent }: ActiveMonitoringProps) {
  const [eventsOpen, setEventsOpen] = useState(false);
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
              <h3 className="font-semibold text-foreground text-base">Event Finder</h3>
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

      {/* Config summary */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Interests</p>
            <p className="text-sm font-semibold text-foreground line-clamp-2">
              {config.interests ? parseAndDeduplicateInterestTags(config.interests).join(", ") : "Not set"}
            </p>
          </div>
          <button
            onClick={onSyncInterests}
            disabled={isSyncingInterests}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-60 flex-shrink-0"
            aria-label="Sync interests from memories"
          >
            {isSyncingInterests ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {config.location || "Not set"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Frequency</p>
            <p className="text-sm font-semibold text-foreground capitalize">{config.frequency}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {config.deliveryMethod === "email" ? (
              <Mail className="w-5 h-5 text-primary" />
            ) : (
              <Phone className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Delivery</p>
            <p className="text-sm font-semibold text-foreground truncate">
              {config.deliveryMethod === "email" ? config.email : "Text message"}
            </p>
          </div>
        </div>
      </div>

      {/* Events list — collapsible */}
      <Collapsible open={eventsOpen} onOpenChange={setEventsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-3 hover:bg-accent/50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-base flex-1 text-left">
              Events found ({stats.eventsFound})
            </h3>
            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${eventsOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {events.length > 0 ? (
            events.map((event) => (
              <FoundEventCard key={event.id} event={event} />
            ))
          ) : (
            <div className="bg-card rounded-2xl border border-border p-5 text-center">
              <p className="text-sm text-muted-foreground">
                No events found yet. Tap "Find events now" to search.
              </p>
            </div>
          )}
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
            {isSyncing ? "Searching…" : "Find events now"}
          </p>
          <p className="text-sm text-muted-foreground">
            Search for events matching your interests
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause event finder
      </button>
    </div>
  );
}
