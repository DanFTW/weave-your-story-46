import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarEventSyncPhase,
  CalendarEventSyncConfig,
  CalendarEventSyncStats,
  PendingCalendarEvent,
} from "@/types/calendarEventSync";

export function useCalendarEventSync() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<CalendarEventSyncPhase>("auth-check");
  const [config, setConfig] = useState<CalendarEventSyncConfig | null>(null);
  const [pendingEvents, setPendingEvents] = useState<PendingCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPushing, setIsPushing] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: CalendarEventSyncStats = {
    eventsCreated: config?.eventsCreated ?? 0,
    isActive: config?.isActive ?? false,
    pendingCount: pendingEvents.filter((e) => e.status === "pending").length,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("calendar_event_sync_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading calendar sync config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          eventsCreated: d.events_created ?? 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("calendar_event_sync_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            eventsCreated: 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }

      // Load pending events
      const { data: pending } = await supabase
        .from("pending_calendar_events" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pending) {
        setPendingEvents(
          (pending as any[]).map((p) => ({
            id: p.id,
            userId: p.user_id,
            memoryId: p.memory_id,
            memoryContent: p.memory_content,
            eventTitle: p.event_title,
            eventDate: p.event_date,
            eventTime: p.event_time,
            eventDescription: p.event_description,
            status: p.status,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const activate = useCallback(async (): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Calendar sync activated", description: "New event memories will auto-create Google Calendar events" });
      return true;
    } catch {
      toast({ title: "Activation failed", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [toast]);

  const deactivate = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Calendar sync paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const updatePendingEvent = useCallback(async (
    eventId: string,
    fields: { eventTitle?: string; eventDate?: string; eventTime?: string; eventDescription?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "update-pending", eventId, ...fields },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }

      setPendingEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                eventTitle: fields.eventTitle ?? e.eventTitle,
                eventDate: fields.eventDate ?? e.eventDate,
                eventTime: fields.eventTime ?? e.eventTime,
                eventDescription: fields.eventDescription ?? e.eventDescription,
              }
            : e
        )
      );
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  }, [toast]);

  const pushToCalendar = useCallback(async (eventId: string): Promise<boolean> => {
    setIsPushing(eventId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "create-event", eventId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Failed to create event", description: error.message, variant: "destructive" });
        return false;
      }

      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
      setConfig((prev) => prev ? { ...prev, eventsCreated: prev.eventsCreated + 1 } : null);
      toast({ title: "Event created", description: "Added to your Google Calendar" });
      return true;
    } catch {
      toast({ title: "Failed to create event", variant: "destructive" });
      return false;
    } finally {
      setIsPushing(null);
    }
  }, [toast]);

  const dismissPending = useCallback(async (eventId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "dismiss-pending", eventId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      toast({ title: "Dismiss failed", variant: "destructive" });
    }
  }, [toast]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("calendar-event-sync", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      const result = data as { processed?: number; created?: number; queued?: number };
      toast({
        title: "Sync complete",
        description: `Processed ${result.processed ?? 0} memories — ${result.created ?? 0} created, ${result.queued ?? 0} queued`,
      });

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, config, stats, pendingEvents,
    isLoading, isActivating, isPushing, isSyncing,
    loadConfig, activate, deactivate,
    updatePendingEvent, pushToCalendar, dismissPending, manualSync,
  };
}
