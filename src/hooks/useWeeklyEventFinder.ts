import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  WeeklyEventFinderPhase,
  WeeklyEventFinderConfig,
  WeeklyEventFinderStats,
  FoundEvent,
} from "@/types/weeklyEventFinder";

export function useWeeklyEventFinder() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<WeeklyEventFinderPhase>("auth-check");
  const [config, setConfig] = useState<WeeklyEventFinderConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [events, setEvents] = useState<FoundEvent[]>([]);

  const stats: WeeklyEventFinderStats = {
    eventsFound: config?.eventsFound ?? 0,
    isActive: config?.isActive ?? false,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("weekly_event_finder_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading weekly event finder config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          interests: d.interests,
          location: d.location,
          frequency: d.frequency ?? "weekly",
          deliveryMethod: d.delivery_method ?? "email",
          email: d.email,
          phoneNumber: d.phone_number ?? null,
          blockedInterests: d.blocked_interests ?? null,
          eventsFound: d.events_found ?? 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
        if (d.is_active) loadEvents();
      } else {
        const { data: newConfig } = await supabase
          .from("weekly_event_finder_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            interests: null,
            location: null,
            frequency: "weekly",
            deliveryMethod: "email",
            email: null,
            phoneNumber: null,
            blockedInterests: null,
            eventsFound: 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("weekly_event_finder_processed" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("processed_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading events:", error);
        return;
      }

      if (data) {
        setEvents((data as any[]).map((d) => ({
          id: d.id,
          eventId: d.event_id,
          eventTitle: d.event_title || "",
          eventDate: d.event_date ?? null,
          eventDescription: d.event_description ?? null,
          eventReason: d.event_reason ?? null,
          eventLink: d.event_link ?? null,
          processedAt: d.processed_at,
        })));
      }
    } catch (e) {
      console.error("Failed to load events:", e);
    }
  }, []);

  const updateConfig = useCallback(async (
    interests: string,
    location: string,
    frequency: string,
    deliveryMethod: string,
    email: string,
    phoneNumber: string,
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("weekly-event-finder", {
        body: { action: "update-config", interests, location, frequency, deliveryMethod, email, phoneNumber },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setConfig((prev) => prev ? {
        ...prev,
        interests,
        location,
        frequency: frequency as "weekly" | "daily",
        deliveryMethod: deliveryMethod as "email" | "text",
        email,
        phoneNumber,
      } : null);
    } catch {
      toast({ title: "Failed to update config", variant: "destructive" });
    }
  }, [toast]);

  const activate = useCallback(async (): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("weekly-event-finder", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Event finder activated", description: "We'll find events matching your interests" });
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

      const { error } = await supabase.functions.invoke("weekly-event-finder", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Event finder paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("weekly-event-finder", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      const result = data as { eventsFound?: number; delivered?: number };
      toast({
        title: "Sync complete",
        description: `Found ${result.eventsFound ?? 0} events — ${result.delivered ?? 0} delivered`,
      });

      await loadEvents();

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  const prefill = useCallback(async (): Promise<{ interests: string; location: string } | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase.functions.invoke("weekly-event-finder", {
        body: { action: "prefill" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) return null;
      return data as { interests: string; location: string } | null;
    } catch {
      return null;
    }
  }, []);

  return {
    phase, setPhase, config, stats, events,
    isLoading, isActivating, isSyncing,
    loadConfig, updateConfig, activate, deactivate, manualSync, prefill, loadEvents,
  };
}
