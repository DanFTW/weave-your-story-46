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
  connect: (customRedirectPath?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const POLLING_INTERVAL = 2000; // 2 seconds
const MAX_POLLING_DURATION = 120000; // 2 minutes

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
  }, [toolkit]);

  // Initiate OAuth connection
  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to connect integrations");
        setConnecting(false);
        return;
      }

      // Build redirect URL to OAuth completion page
      const baseUrl = "https://weavefabric.lovable.app";
      
      // Use lowercase toolkit - this is the canonical format expected by Composio
      const toolkitLower = toolkit.toLowerCase();
      
      console.log(`Initiating ${toolkitLower} OAuth...`);
      console.log(`Running in Median: ${isMedian()}`);

      const { data, error } = await supabase.functions.invoke("composio-connect", {
        body: { 
          toolkit: toolkitLower,
          baseUrl,
        },
      });

      if (error) {
        console.error("Connect error:", error);
        
        // Try to extract meaningful error message
        let errorMessage = "Failed to start connection";
        if (error.message) {
          try {
            const parsed = JSON.parse(error.message);
            errorMessage = parsed.message || parsed.error || errorMessage;
          } catch {
            errorMessage = error.message;
          }
        }
        
        toast.error(errorMessage);
        setConnecting(false);
        return;
      }

      console.log("Connect response:", data);

      // Handle structured error responses from edge function
      if (data?.error) {
        console.error("Connect error response:", data);
        const errorMessage = data.message || data.error || "Failed to start connection";
        
        if (data.configured_toolkits) {
          console.log("Available toolkits:", data.configured_toolkits);
        }
        
        toast.error(errorMessage);
        setConnecting(false);
        return;
      }

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
        // Standard web - open in new window to keep current page active for polling
        // This allows polling to continue while OAuth happens in popup
        const popup = window.open(data.redirectUrl, '_blank', 'width=600,height=700');
        
        if (!popup) {
          console.log("Popup blocked, using standard redirect");
          // Stop polling since we're doing a full redirect
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Use top-level window to escape iframe
          const targetWindow = window.top || window;
          targetWindow.location.assign(data.redirectUrl);
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect integration. Please try again.");
      setConnecting(false);
    }
  }, [toolkit, startPolling]);

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

  // Disconnect integration
  const disconnect = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from("user_integrations")
        .delete()
        .eq("user_id", session.user.id)
        .eq("integration_id", toolkit.toLowerCase());

      setConnectedAccount(null);
      setIsConnected(false);
      toast.success("Integration disconnected");
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect");
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
