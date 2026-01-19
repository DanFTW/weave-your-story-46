import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isMedian, median } from "@/utils/median";

export interface GooglePhotosAccount {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface UseGooglePhotosAuthReturn {
  connectedAccount: GooglePhotosAccount | null;
  connecting: boolean;
  isConnected: boolean;
  oauthUrl: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
  cancelConnect: () => void;
}

const POLLING_INTERVAL = 2000; // 2 seconds
const MAX_POLLING_DURATION = 120000; // 2 minutes

export function useGooglePhotosAuth(): UseGooglePhotosAuthReturn {
  const [connectedAccount, setConnectedAccount] = useState<GooglePhotosAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingStartTimeRef = useRef<number>(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll the database for connection status changes
  const startPolling = useCallback(async () => {
    pollingStartTimeRef.current = Date.now();
    
    const pollForConnection = async () => {
      // Check if we've exceeded max polling duration
      if (Date.now() - pollingStartTimeRef.current > MAX_POLLING_DURATION) {
        console.log("Polling timed out");
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
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
          .eq("integration_id", "googlephotos")
          .eq("status", "connected")
          .maybeSingle();

        if (error) {
          console.error("Polling error:", error);
          return;
        }

        if (integration) {
          console.log("Connection detected via polling!", integration);
          
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Update state
          setConnectedAccount({
            name: integration.account_name || "",
            email: integration.account_email || "",
            avatarUrl: integration.account_avatar_url || undefined,
          });
          setIsConnected(true);
          setConnecting(false);
          
          toast.success("Google Photos connected successfully!");
        }
      } catch (error) {
        console.error("Error during polling:", error);
      }
    };

    // Start polling
    pollingIntervalRef.current = setInterval(pollForConnection, POLLING_INTERVAL);
    
    // Also poll immediately
    pollForConnection();
  }, []);

  // Store the OAuth URL for manual fallback
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

  // Initiate OAuth connection using native Google OAuth
  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setOauthUrl(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to connect Google Photos");
        setConnecting(false);
        return;
      }

      // Build redirect URL using current origin
      const baseUrl = window.location.origin;
      
      // Store return URL for redirect after OAuth completion
      sessionStorage.setItem('oauth_return_url', `${baseUrl}/integration/googlephotos`);
      
      console.log("Initiating Google Photos OAuth...");
      console.log(`Running in Median: ${isMedian()}`);
      console.log(`Using base URL: ${baseUrl}`);

      // Call our new native Google OAuth edge function
      const { data, error } = await supabase.functions.invoke("google-photos-auth", {
        body: { baseUrl },
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

      // Store OAuth URL for manual fallback
      setOauthUrl(data.redirectUrl);

      // Start polling for connection status
      startPolling();

      // Handle OAuth redirect based on platform
      if (isMedian()) {
        console.log("Opening OAuth in Median app browser...");
        const opened = median.window.open(data.redirectUrl, 'appbrowser');
        
        if (!opened) {
          console.log("Median app browser not available, using standard redirect");
          // Stop polling since we're doing a full redirect
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          window.location.assign(data.redirectUrl);
        }
      } else {
        // Standard web - open as a new tab (not popup with dimensions - more reliable)
        // Using noopener,noreferrer for security
        const newTab = window.open(data.redirectUrl, '_blank', 'noopener,noreferrer');
        
        if (!newTab || newTab.closed) {
          console.log("Tab blocked - showing manual instructions");
          // Don't try to redirect in iframe - just show manual link
          toast.info("Click the link below to authorize Google Photos", {
            duration: 10000,
          });
        } else {
          toast.info("Complete authorization in the new tab, then return here", {
            duration: 8000,
          });
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect Google Photos");
      setConnecting(false);
      setOauthUrl(null);
    }
  }, [startPolling]);

  // Cancel connection attempt
  const cancelConnect = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setConnecting(false);
    setOauthUrl(null);
  }, []);

  // Check existing connection status
  const checkStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: integration } = await supabase
        .from("user_integrations")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("integration_id", "googlephotos")
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
  }, []);

  // Disconnect integration
  const disconnect = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", session.user.id)
        .eq("integration_id", "googlephotos");

      setConnectedAccount(null);
      setIsConnected(false);
      toast.success("Google Photos disconnected");
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect");
    }
  }, []);

  return {
    connectedAccount,
    connecting,
    isConnected,
    oauthUrl,
    connect,
    disconnect,
    checkStatus,
    cancelConnect,
  };
}
