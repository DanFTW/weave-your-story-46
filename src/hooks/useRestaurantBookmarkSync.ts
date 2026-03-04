import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  RestaurantBookmarkSyncPhase,
  RestaurantBookmarkSyncConfig,
  RestaurantBookmarkSyncStats,
  PendingRestaurantBookmark,
} from "@/types/restaurantBookmarkSync";

export function useRestaurantBookmarkSync() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<RestaurantBookmarkSyncPhase>("auth-check");
  const [config, setConfig] = useState<RestaurantBookmarkSyncConfig | null>(null);
  const [pendingBookmarks, setPendingBookmarks] = useState<PendingRestaurantBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPushing, setIsPushing] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: RestaurantBookmarkSyncStats = {
    restaurantsBookmarked: config?.restaurantsBookmarked ?? 0,
    isActive: config?.isActive ?? false,
    pendingCount: pendingBookmarks.filter((b) => b.status === "pending").length,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("restaurant_bookmark_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading restaurant bookmark config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          isActive: d.is_active,
          restaurantsBookmarked: d.restaurants_bookmarked ?? 0,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("restaurant_bookmark_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            isActive: false,
            restaurantsBookmarked: 0,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          });
        }
        setPhase("configure");
      }

      // Load pending bookmarks
      const { data: pending } = await supabase
        .from("pending_restaurant_bookmarks" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (pending) {
        setPendingBookmarks(
          (pending as any[]).map((p) => ({
            id: p.id,
            userId: p.user_id,
            memoryId: p.memory_id,
            memoryContent: p.memory_content,
            restaurantName: p.restaurant_name,
            restaurantAddress: p.restaurant_address,
            restaurantCuisine: p.restaurant_cuisine,
            restaurantNotes: p.restaurant_notes,
            placeId: p.place_id ?? null,
            googleMapsUrl: p.google_maps_url ?? null,
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

      const { error } = await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "activate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true } : null);
      setPhase("active");
      toast({ title: "Restaurant bookmark sync activated", description: "New restaurant memories will auto-bookmark to Google Maps" });
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

      const { error } = await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "deactivate" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Restaurant bookmark sync paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const updatePendingBookmark = useCallback(async (
    bookmarkId: string,
    fields: { restaurantName?: string; restaurantAddress?: string; restaurantCuisine?: string; restaurantNotes?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "update-pending", bookmarkId, ...fields },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }

      setPendingBookmarks((prev) =>
        prev.map((b) =>
          b.id === bookmarkId
            ? {
                ...b,
                restaurantName: fields.restaurantName ?? b.restaurantName,
                restaurantAddress: fields.restaurantAddress ?? b.restaurantAddress,
                restaurantCuisine: fields.restaurantCuisine ?? b.restaurantCuisine,
                restaurantNotes: fields.restaurantNotes ?? b.restaurantNotes,
              }
            : b
        )
      );
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  }, [toast]);

  const pushBookmark = useCallback(async (bookmarkId: string): Promise<boolean> => {
    setIsPushing(bookmarkId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "create-bookmark", bookmarkId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Failed to find restaurant", description: error.message, variant: "destructive" });
        return false;
      }

      const responseData = data as { googleMapsUrl?: string };

      // Update the bookmark in local state with the Maps URL instead of removing it
      setPendingBookmarks((prev) => prev.map((b) =>
        b.id === bookmarkId
          ? { ...b, status: "completed" as const, googleMapsUrl: responseData?.googleMapsUrl ?? b.googleMapsUrl }
          : b
      ));
      setConfig((prev) => prev ? { ...prev, restaurantsBookmarked: prev.restaurantsBookmarked + 1 } : null);
      toast({ title: "Restaurant found on Maps", description: "Tap the link to view and save it" });
      return true;
    } catch {
      toast({ title: "Failed to find restaurant", variant: "destructive" });
      return false;
    } finally {
      setIsPushing(null);
    }
  }, [toast]);

  const dismissPending = useCallback(async (bookmarkId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "dismiss-pending", bookmarkId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      setPendingBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    } catch {
      toast({ title: "Dismiss failed", variant: "destructive" });
    }
  }, [toast]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("restaurant-bookmark-sync", {
        body: { action: "manual-sync" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Sync failed", description: error.message, variant: "destructive" });
        return;
      }

      const result = data as { processed?: number; bookmarked?: number; queued?: number };
      toast({
        title: "Sync complete",
        description: `Processed ${result.processed ?? 0} memories — ${result.bookmarked ?? 0} bookmarked, ${result.queued ?? 0} queued`,
      });

      await loadConfig();
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast, loadConfig]);

  return {
    phase, setPhase, config, stats, pendingBookmarks,
    isLoading, isActivating, isPushing, isSyncing,
    loadConfig, activate, deactivate,
    updatePendingBookmark, pushBookmark, dismissPending, manualSync,
  };
}
