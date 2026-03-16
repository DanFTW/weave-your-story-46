import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useComposio } from "@/hooks/useComposio";
import {
  TwitterAlphaTrackerPhase,
  TrackedTwitterAccount,
  TrackedTwitterAccountWithStats,
  TwitterAlphaTrackerStats,
} from "@/types/twitterAlphaTracker";

export function useTwitterAlphaTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { disconnect: disconnectTwitter } = useComposio("twitter");

  const [phase, setPhase] = useState<TwitterAlphaTrackerPhase>("auth-check");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [searchResults, setSearchResults] = useState<TrackedTwitterAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<TrackedTwitterAccount[]>([]);
  const [stats, setStats] = useState<TwitterAlphaTrackerStats>({
    totalPostsTracked: 0,
    isActive: false,
    lastChecked: null,
    trackedAccounts: [],
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
        toast({
          title: "Twitter not connected",
          description: "Please connect your Twitter account first.",
        });
        sessionStorage.setItem('returnAfterTwitterConnect', '/flow/twitter-alpha-tracker');
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

      // Fetch tracked accounts from new table
      const { data: trackedAccounts, error: accountsError } = await supabase
        .from("twitter_alpha_tracked_accounts")
        .select("*")
        .eq("user_id", user.id);

      if (accountsError) throw accountsError;

      const accountsWithStats: TrackedTwitterAccountWithStats[] = (trackedAccounts || []).map((a: any) => ({
        id: a.id,
        username: a.username,
        userId: a.user_id_twitter,
        displayName: a.display_name || undefined,
        avatarUrl: a.avatar_url || undefined,
        postsTracked: a.posts_tracked || 0,
      }));

      const totalPosts = accountsWithStats.reduce((sum, a) => sum + a.postsTracked, 0);

      if (config && config.is_active && accountsWithStats.length > 0) {
        // Already active with accounts
        setStats({
          totalPostsTracked: totalPosts,
          isActive: true,
          lastChecked: config.last_polled_at,
          trackedAccounts: accountsWithStats,
        });
        setPhase("active");
      } else if (accountsWithStats.length > 0) {
        // Has selected accounts but not active
        setSelectedAccounts(accountsWithStats.map(a => ({
          username: a.username,
          userId: a.userId,
          displayName: a.displayName,
          avatarUrl: a.avatarUrl,
        })));
        setStats({
          totalPostsTracked: totalPosts,
          isActive: false,
          lastChecked: config?.last_polled_at || null,
          trackedAccounts: accountsWithStats,
        });
        setPhase("configure");
      } else {
        // No accounts - go to account selection
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

        if (data?.needsReconnect) {
          toast({
            title: "Twitter connection expired",
            description: data.error || "Please reconnect Twitter to continue.",
            variant: "destructive",
          });
          await disconnectTwitter();
          sessionStorage.setItem("returnAfterTwitterConnect", "/flow/twitter-alpha-tracker");
          navigate("/integration/twitter");
          return;
        }

        if (data?.user) {
          setSearchResults([
            {
              username: data.user.username,
              userId: data.user.userId,
              displayName: data.user.displayName,
              avatarUrl: data.user.avatarUrl,
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
    [user?.id, toast, disconnectTwitter, navigate]
  );

  // Add account to selection
  const addAccount = useCallback((account: TrackedTwitterAccount) => {
    setSelectedAccounts((prev) => {
      if (prev.some((a) => a.username === account.username)) {
        return prev;
      }
      return [...prev, account];
    });
    setSearchResults([]);
  }, []);

  // Remove account from selection
  const removeSelectedAccount = useCallback((username: string) => {
    setSelectedAccounts((prev) => prev.filter((a) => a.username !== username));
  }, []);

  // Confirm account selection and save to database
  const confirmAccountSelection = useCallback(async () => {
    if (!user?.id || selectedAccounts.length === 0) return;

    setIsActivating(true);
    try {
      const { error } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "add-accounts", accounts: selectedAccounts },
        }
      );

      if (error) throw error;

      // Refresh stats
      const { data: trackedAccounts } = await supabase
        .from("twitter_alpha_tracked_accounts")
        .select("*")
        .eq("user_id", user.id);

      const accountsWithStats: TrackedTwitterAccountWithStats[] = (trackedAccounts || []).map((a: any) => ({
        id: a.id,
        username: a.username,
        userId: a.user_id_twitter,
        displayName: a.display_name || undefined,
        avatarUrl: a.avatar_url || undefined,
        postsTracked: a.posts_tracked || 0,
      }));

      setStats((prev) => ({
        ...prev,
        trackedAccounts: accountsWithStats,
        totalPostsTracked: accountsWithStats.reduce((sum, a) => sum + a.postsTracked, 0),
      }));

      setPhase("configure");
    } catch (error) {
      console.error("Error saving accounts:", error);
      toast({
        title: "Error",
        description: "Failed to save selected accounts",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  }, [user?.id, selectedAccounts, toast]);

  // Remove a tracked account
  const removeTrackedAccount = useCallback(
    async (username: string) => {
      if (!user?.id) return;

      try {
        const { error } = await supabase.functions.invoke(
          "twitter-alpha-tracker",
          {
            body: { action: "remove-account", username },
          }
        );

        if (error) throw error;

        setStats((prev) => ({
          ...prev,
          trackedAccounts: prev.trackedAccounts.filter((a) => a.username !== username),
          totalPostsTracked: prev.trackedAccounts
            .filter((a) => a.username !== username)
            .reduce((sum, a) => sum + a.postsTracked, 0),
        }));

        toast({
          title: "Account removed",
          description: `Stopped tracking @${username}`,
        });

        // If no accounts left, go back to selection
        if (stats.trackedAccounts.length <= 1) {
          setPhase("select-account");
        }
      } catch (error) {
        console.error("Error removing account:", error);
        toast({
          title: "Error",
          description: "Failed to remove account",
          variant: "destructive",
        });
      }
    },
    [user?.id, stats.trackedAccounts.length, toast]
  );

  // Activate tracking
  const activateTracking = useCallback(async () => {
    if (!user?.id || stats.trackedAccounts.length === 0) return;

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

      setStats((prev) => ({
        ...prev,
        isActive: true,
        lastChecked: new Date().toISOString(),
      }));
      setPhase("active");

      toast({
        title: "Tracking activated!",
        description: `Now monitoring ${stats.trackedAccounts.length} account${stats.trackedAccounts.length > 1 ? "s" : ""}`,
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
  }, [user?.id, stats.trackedAccounts.length, toast]);

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

      // Refresh tracked accounts to get updated stats
      const { data: trackedAccounts } = await supabase
        .from("twitter_alpha_tracked_accounts")
        .select("*")
        .eq("user_id", user.id);

      const accountsWithStats: TrackedTwitterAccountWithStats[] = (trackedAccounts || []).map((a: any) => ({
        id: a.id,
        username: a.username,
        userId: a.user_id_twitter,
        displayName: a.display_name || undefined,
        avatarUrl: a.avatar_url || undefined,
        postsTracked: a.posts_tracked || 0,
      }));

      setStats((prev) => ({
        ...prev,
        trackedAccounts: accountsWithStats,
        totalPostsTracked: accountsWithStats.reduce((sum, a) => sum + a.postsTracked, 0),
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

  // Reset sync - clears processed posts to allow re-sync
  const resetSync = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke(
        "twitter-alpha-tracker",
        {
          body: { action: "reset-sync" },
        }
      );

      if (error) throw error;

      // Reset local stats
      setStats((prev) => ({
        ...prev,
        totalPostsTracked: 0,
        trackedAccounts: prev.trackedAccounts.map(a => ({ ...a, postsTracked: 0 })),
      }));

      toast({
        title: "Sync reset",
        description: data?.message || "Sync history cleared. Click 'Sync Now' to re-process tweets.",
      });
    } catch (error) {
      console.error("Error resetting sync:", error);
      toast({
        title: "Error",
        description: "Failed to reset sync history",
        variant: "destructive",
      });
    }
  }, [user?.id, toast]);

  // Go to add more accounts
  const goToAddAccounts = useCallback(() => {
    setSearchResults([]);
    setPhase("select-account");
  }, []);

  return {
    phase,
    isLoading,
    isSearching,
    isActivating,
    searchResults,
    selectedAccounts,
    stats,
    searchUsers,
    addAccount,
    removeSelectedAccount,
    confirmAccountSelection,
    removeTrackedAccount,
    activateTracking,
    deactivateTracking,
    manualPoll,
    resetSync,
    goToAddAccounts,
  };
}
