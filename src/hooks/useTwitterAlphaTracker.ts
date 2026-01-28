import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  TwitterAlphaTrackerPhase,
  TrackedTwitterAccount,
  TwitterAlphaTrackerStats,
} from "@/types/twitterAlphaTracker";

export function useTwitterAlphaTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<TwitterAlphaTrackerPhase>("auth-check");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [searchResults, setSearchResults] = useState<TrackedTwitterAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrackedTwitterAccount | null>(null);
  const [stats, setStats] = useState<TwitterAlphaTrackerStats>({
    postsTracked: 0,
    isActive: false,
    lastChecked: null,
    trackedAccount: null,
  });

  // Check Twitter connection and existing config
  const checkConnection = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Check if Twitter is connected
      const { data: integration, error: integrationError } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", user.id)
        .eq("integration_id", "twitter")
        .eq("status", "connected")
        .maybeSingle();

      if (integrationError) throw integrationError;

      if (!integration) {
        // Not connected - redirect to integration page
        toast({
          title: "Twitter not connected",
          description: "Please connect your Twitter account first.",
        });
        navigate("/integration/twitter");
        return;
      }

      // Check for existing config
      const { data: config, error: configError } = await supabase
        .from("twitter_alpha_tracker_config")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (configError) throw configError;

      if (config && config.is_active) {
        // Already active - go to dashboard
        setStats({
          postsTracked: config.posts_tracked || 0,
          isActive: true,
          lastChecked: config.last_polled_at,
          trackedAccount: config.tracked_username
            ? {
                username: config.tracked_username,
                userId: config.tracked_user_id || "",
                displayName: config.tracked_display_name || undefined,
                avatarUrl: config.tracked_avatar_url || undefined,
              }
            : null,
        });
        setPhase("active");
      } else if (config && config.tracked_username) {
        // Has selected account but not active
        setSelectedAccount({
          username: config.tracked_username,
          userId: config.tracked_user_id || "",
          displayName: config.tracked_display_name || undefined,
          avatarUrl: config.tracked_avatar_url || undefined,
        });
        setPhase("configure");
      } else {
        // No config - go to account selection
        setPhase("select-account");
      }
    } catch (error) {
      console.error("Error checking connection:", error);
      toast({
        title: "Error",
        description: "Failed to check connection status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, navigate, toast]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Search for Twitter users
  const searchUsers = useCallback(
    async (query: string) => {
      if (!user?.id || !query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "twitter-alpha-tracker",
          {
            body: { action: "search-user", username: query.trim() },
          }
        );

        if (error) throw error;

        if (data?.user) {
          setSearchResults([
            {
              username: data.user.username,
              userId: data.user.id,
              displayName: data.user.name,
              avatarUrl: data.user.profile_image_url,
            },
          ]);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [user?.id]
  );

  // Select account to track
  const selectAccount = useCallback(
    async (account: TrackedTwitterAccount) => {
      if (!user?.id) return;

      try {
        const { error } = await supabase.functions.invoke(
          "twitter-alpha-tracker",
          {
            body: { action: "select-account", account },
          }
        );

        if (error) throw error;

        setSelectedAccount(account);
        setPhase("configure");
      } catch (error) {
        console.error("Error selecting account:", error);
        toast({
          title: "Error",
          description: "Failed to save selected account",
          variant: "destructive",
        });
      }
    },
    [user?.id, toast]
  );

  // Activate tracking
  const activateTracking = useCallback(async () => {
    if (!user?.id || !selectedAccount) return;

    setPhase("activating");
    setIsActivating(true);

    try {
      const { error } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "activate" },
        }
      );

      if (error) throw error;

      setStats({
        postsTracked: 0,
        isActive: true,
        lastChecked: new Date().toISOString(),
        trackedAccount: selectedAccount,
      });
      setPhase("active");

      toast({
        title: "Tracking activated!",
        description: `Now monitoring @${selectedAccount.username}`,
      });
    } catch (error) {
      console.error("Error activating tracking:", error);
      toast({
        title: "Activation failed",
        description: "Failed to start tracking. Please try again.",
        variant: "destructive",
      });
      setPhase("configure");
    } finally {
      setIsActivating(false);
    }
  }, [user?.id, selectedAccount, toast]);

  // Deactivate tracking
  const deactivateTracking = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "deactivate" },
        }
      );

      if (error) throw error;

      setStats((prev) => ({ ...prev, isActive: false }));
      setPhase("configure");

      toast({
        title: "Tracking paused",
        description: "You can resume anytime.",
      });
    } catch (error) {
      console.error("Error deactivating:", error);
      toast({
        title: "Error",
        description: "Failed to pause tracking",
        variant: "destructive",
      });
    }
  }, [user?.id, toast]);

  // Manual poll
  const manualPoll = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "manual-poll" },
        }
      );

      if (error) throw error;

      setStats((prev) => ({
        ...prev,
        postsTracked: data?.postsTracked ?? prev.postsTracked,
        lastChecked: new Date().toISOString(),
      }));

      toast({
        title: "Check complete",
        description: data?.newPosts
          ? `Found ${data.newPosts} new posts!`
          : "No new posts found.",
      });
    } catch (error) {
      console.error("Error polling:", error);
      toast({
        title: "Error",
        description: "Failed to check for new posts",
        variant: "destructive",
      });
    }
  }, [user?.id, toast]);

  // Change tracked account
  const changeAccount = useCallback(() => {
    setSelectedAccount(null);
    setSearchResults([]);
    setPhase("select-account");
  }, []);

  return {
    phase,
    isLoading,
    isSearching,
    isActivating,
    searchResults,
    selectedAccount,
    stats,
    searchUsers,
    selectAccount,
    activateTracking,
    deactivateTracking,
    manualPoll,
    changeAccount,
  };
}
