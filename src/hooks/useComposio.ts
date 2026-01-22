import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isMedian, median } from "@/utils/median";

export interface ConnectedAccount {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface UseComposioReturn {
  connectedAccount: ConnectedAccount | null;
  connecting: boolean;
  isConnected: boolean;
  connect: (customRedirectPath?: string, forceReauth?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const POLLING_INTERVAL = 2000; // 2 seconds
const MAX_POLLING_DURATION = 120000; // 2 minutes

// Detect mobile browser
function isMobileBrowser(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function useComposio(toolkit: string): UseComposioReturn {
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number>(0);
  const pendingConnectionIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Poll the database for connection status changes
  const startPolling = useCallback(async () => {
    pollingStartTimeRef.current = Date.now();
    
    const pollForConnection = async () => {
      // Check if we've exceeded max polling duration
      if (Date.now() - pollingStartTimeRef.current > MAX_POLLING_DURATION) {
        console.log("Polling timed out");
        stopPolling();
        setConnecting(false);
        toast.error("Connection timed out. Please try again.");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check for connected status in database
        const { data: integration, error } = await supabase
          .from("user_integrations")
          .select("*")
          .eq("user_id", session.user.id)
          .eq("integration_id", toolkit.toLowerCase())
          .eq("status", "connected")
          .maybeSingle();

        if (error) {
          console.error("Polling error:", error);
          return;
        }

        if (integration) {
          console.log("Connection detected via polling!", integration);
          
          // Stop polling
          stopPolling();
          
          // Update state
          setConnectedAccount({
            name: integration.account_name || "",
            email: integration.account_email || "",
            avatarUrl: integration.account_avatar_url || undefined,
          });
          setIsConnected(true);
          setConnecting(false);
          pendingConnectionIdRef.current = null;
          
          toast.success(`${toolkit} connected successfully!`);
        }
      } catch (error) {
        console.error("Error during polling:", error);
      }
    };

    // Start polling
    pollingIntervalRef.current = setInterval(pollForConnection, POLLING_INTERVAL);
    
    // Also poll immediately
    pollForConnection();
  }, [toolkit, stopPolling]);

  // Initiate OAuth connection
  // forceReauth: when true, forces Instagram to show login/account selection
  // Use false for initial connections, true for account switching
  const connect = useCallback(async (customRedirectPath?: string, forceReauth: boolean = false) => {
    try {
      setConnecting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to connect integrations");
        setConnecting(false);
        return;
      }

      // Build redirect URL to OAuth completion page using current origin
      const baseUrl = window.location.origin;
      
      // Store return URL for redirect after OAuth completion
      // Use localStorage on mobile (survives navigation to external OAuth sites)
      // Use sessionStorage on desktop (more secure, cleared on tab close)
      const isMobile = isMobileBrowser();
      const returnUrl = customRedirectPath 
        ? `${baseUrl}${customRedirectPath}`
        : `${baseUrl}/integration/${toolkit.toLowerCase()}`;
      if (isMobile) {
        localStorage.setItem('oauth_return_url', returnUrl);
      } else {
        sessionStorage.setItem('oauth_return_url', returnUrl);
      }
      
      console.log(`Initiating ${toolkit} OAuth (forceReauth: ${forceReauth})...`);
      console.log(`Running in Median: ${isMedian()}, Mobile: ${isMobile}`);
      console.log(`Using base URL: ${baseUrl}`);

      const { data, error } = await supabase.functions.invoke("composio-connect", {
        body: { 
          toolkit: toolkit.toUpperCase(),
          // Pass base URL, edge function will build complete callback URL
          baseUrl,
          // Only force re-auth when switching accounts
          forceReauth,
        },
      });

      if (error) {
        console.error("Connect error:", error);
        toast.error("Failed to start connection");
        setConnecting(false);
        return;
      }

      console.log("Connect response:", data);

      if (!data?.redirectUrl) {
        toast.error("No redirect URL received");
        setConnecting(false);
        return;
      }

      // Store connection ID for tracking
      if (data.connectionId) {
        pendingConnectionIdRef.current = data.connectionId;
      }

      // Start polling for connection status
      // This works regardless of localStorage isolation in Median
      startPolling();

      // Handle OAuth redirect based on platform
      if (isMedian()) {
        // Median app browser - best experience for native apps
        console.log("Opening OAuth in Median app browser...");
        const opened = median.window.open(data.redirectUrl, 'appbrowser');
        
        if (!opened) {
          console.log("Median app browser not available, using standard redirect");
          stopPolling();
          window.location.assign(data.redirectUrl);
        }
      } else if (isMobile) {
        // Mobile browsers - use direct redirect instead of popup
        // Popups are unreliable on mobile, especially iOS Safari
        // This avoids AbortError and popup blocking issues
        console.log("Mobile detected, using direct redirect for OAuth...");
        stopPolling();
        window.location.assign(data.redirectUrl);
      } else {
        // Desktop - try popup, fallback to redirect
        // Popup allows polling to continue in background
        const popup = window.open(data.redirectUrl, '_blank', 'width=600,height=700');
        
        if (!popup) {
          console.log("Popup blocked, using standard redirect");
          stopPolling();
          // Use top-level window to escape iframe
          const targetWindow = window.top || window;
          targetWindow.location.assign(data.redirectUrl);
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect integration");
      setConnecting(false);
    }
  }, [toolkit, startPolling, stopPolling]);

  // Check existing connection status
  const checkStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: integration } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("integration_id", toolkit.toLowerCase())
        .eq("status", "connected")
        .maybeSingle();

      if (integration) {
        setConnectedAccount({
          name: integration.account_name || "",
          email: integration.account_email || "",
          avatarUrl: integration.account_avatar_url || undefined,
        });
        setIsConnected(true);
      } else {
        setConnectedAccount(null);
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Error checking status:", error);
    }
  }, [toolkit]);

  // Disconnect integration - calls edge function to revoke from Composio + delete from DB
  const disconnect = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Call composio-auth edge function to properly disconnect
      // This deletes from BOTH Composio AND our database
      const { error } = await supabase.functions.invoke("composio-auth", {
        body: {
          action: "disconnect",
          integrationId: toolkit.toLowerCase(),
        },
      });

      if (error) {
        console.error("Disconnect error from edge function:", error);
        // Fallback: try direct database delete
        await supabase
          .from("user_integrations")
          .delete()
          .eq("user_id", session.user.id)
          .eq("integration_id", toolkit.toLowerCase());
      }

      setConnectedAccount(null);
      setIsConnected(false);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to sign out");
    }
  }, [toolkit]);

  return {
    connectedAccount,
    connecting,
    isConnected,
    connect,
    disconnect,
    checkStatus,
  };
}
