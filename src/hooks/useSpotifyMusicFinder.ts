import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  SpotifyMusicFinderPhase,
  SpotifyMusicFinderConfig,
  SpotifyMusicFinderStats,
  SpotifyPlaylist,
} from "@/types/spotifyMusicFinder";

export function useSpotifyMusicFinder() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<SpotifyMusicFinderPhase>("auth-check");
  const [config, setConfig] = useState<SpotifyMusicFinderConfig | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const stats: SpotifyMusicFinderStats = {
    songsAdded: config?.songsAdded ?? 0,
    isActive: config?.isActive ?? false,
    frequency: config?.frequency ?? "daily",
    playlistName: config?.playlistName ?? null,
    lastPolledAt: config?.lastPolledAt ?? null,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase("auth-check"); return; }

      const { data, error } = await supabase
        .from("spotify_music_finder_config" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading spotify config:", error);
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id,
          userId: d.user_id,
          playlistId: d.playlist_id,
          playlistName: d.playlist_name,
          frequency: d.frequency || "daily",
          isActive: d.is_active,
          songsAdded: d.songs_added ?? 0,
          lastPolledAt: d.last_polled_at,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? "active" : "configure");
      } else {
        const { data: newConfig } = await supabase
          .from("spotify_music_finder_config" as any)
          .insert({ user_id: user.id, is_active: false })
          .select()
          .single();

        if (newConfig) {
          const d = newConfig as any;
          setConfig({
            id: d.id,
            userId: d.user_id,
            playlistId: null,
            playlistName: null,
            frequency: "daily",
            isActive: false,
            songsAdded: 0,
            lastPolledAt: null,
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

  const loadPlaylists = useCallback(async () => {
    setIsLoadingPlaylists(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("spotify-music-finder", {
        body: { action: "list-playlists" },
      });

      if (error) {
        toast({ title: "Failed to load playlists", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.playlists) {
        setPlaylists(data.playlists);
      }
    } catch {
      toast({ title: "Failed to load playlists", variant: "destructive" });
    } finally {
      setIsLoadingPlaylists(false);
    }
  }, [toast]);

  const activate = useCallback(async (playlistId: string, playlistName: string, frequency: "daily" | "weekly"): Promise<boolean> => {
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", variant: "destructive" });
        return false;
      }

      const { error } = await supabase.functions.invoke("spotify-music-finder", {
        body: { action: "activate", playlistId, playlistName, frequency },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: true, playlistId, playlistName, frequency } : null);
      setPhase("active");
      toast({ title: "Music Discovery activated", description: "Songs will be added to your playlist automatically" });
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

      const { error } = await supabase.functions.invoke("spotify-music-finder", {
        body: { action: "deactivate" },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      setConfig((prev) => prev ? { ...prev, isActive: false } : null);
      setPhase("configure");
      toast({ title: "Music Discovery paused" });
      return true;
    } catch {
      return false;
    }
  }, [toast]);

  const manualPoll = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("spotify-music-finder", {
        body: { action: "manual-poll" },
      });

      if (error) {
        toast({ title: "Discovery failed", description: error.message, variant: "destructive" });
        return;
      }

      if (data?.added) {
        toast({
          title: "Song added!",
          description: `"${data.trackName}" by ${data.trackArtist} added to your playlist`,
        });
        setConfig((prev) => prev ? { ...prev, songsAdded: prev.songsAdded + 1, lastPolledAt: new Date().toISOString() } : null);
      } else if (data?.skipped) {
        toast({ title: "No new song this time", description: data.reason || "Try again later" });
      }
    } catch {
      toast({ title: "Discovery failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  return {
    phase, setPhase, config, stats, playlists,
    isLoading, isActivating, isLoadingPlaylists, isSyncing,
    loadConfig, loadPlaylists, activate, deactivate, manualPoll,
  };
}
