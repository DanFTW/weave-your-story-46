import { useState, useCallback } from "react";
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
  completeConnection: (connectionId?: string) => Promise<{ success: boolean; email?: string } | undefined>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

export function useComposio(toolkit: string): UseComposioReturn {
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Complete connection after OAuth redirect
  const completeConnection = useCallback(async (connectionId?: string) => {
    try {
      // Clean up any Median callback
      if (typeof window !== 'undefined' && window.median_appbrowser_closed) {
        delete window.median_appbrowser_closed;
      }

      const pendingId = connectionId || localStorage.getItem("composio_pending_connection");
      const pendingToolkit = localStorage.getItem("composio_pending_toolkit") || toolkit;
      
      if (!pendingId) {
        console.log("No pending connection ID found");
        return;
      }

      console.log(`Completing connection for: ${pendingId}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No session for completing connection");
        return;
      }

      const { data, error } = await supabase.functions.invoke("composio-callback", {
        body: { 
          connectionId: pendingId,
          userId: session.user.id,
          toolkit: pendingToolkit,
        },
      });

      console.log("Callback response:", data);

      if (error) {
        console.error("Callback error:", error);
        return { success: false };
      }
      
      if (data?.success) {
        setConnectedAccount({
          name: data.name || data.account?.account_name || "",
          email: data.email || data.account?.account_email || "",
          avatarUrl: data.avatarUrl || data.account?.account_avatar_url,
        });
        setIsConnected(true);
        localStorage.removeItem("composio_pending_connection");
        localStorage.removeItem("composio_pending_toolkit");
        localStorage.removeItem("median_oauth_in_progress");
        toast.success(`${toolkit} connected successfully!`);
        return { success: true, email: data.email };
      }

      // If not active yet, might need to retry
      if (data?.status && data.status !== "connected" && data.status !== "ACTIVE") {
        console.log(`Connection status: ${data.status}`);
        return { success: false };
      }

      return { success: false };
    } catch (error) {
      console.error("Error completing connection:", error);
      return { success: false };
    }
  }, [toolkit]);

  // Initiate OAuth connection
  const connect = useCallback(async (customRedirectPath?: string) => {
    try {
      setConnecting(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to connect integrations");
        setConnecting(false);
        return;
      }

      const currentPath = customRedirectPath || window.location.pathname;
      
      // Build redirect URL - always use standard HTTPS URL
      // OAuth providers can't redirect to custom URL schemes (weavefabric.https://...)
      // The appbrowser mode keeps the flow within the Median app context instead
      const baseUrl = "https://weavefabric.lovable.app";
      const redirectUrl = isMedian() 
        ? `${baseUrl}${currentPath}?connected=true`
        : `${window.location.origin}${currentPath}?connected=true`;
      
      if (isMedian()) {
        console.log(`Running in Median app, using standard HTTPS redirect with appbrowser mode`);
      }

      console.log(`Initiating ${toolkit} OAuth...`);
      console.log(`Redirect URL: ${redirectUrl}`);

      const { data, error } = await supabase.functions.invoke("composio-connect", {
        body: { toolkit: toolkit.toUpperCase(), redirectUrl },
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

      // Store connection ID for later
      if (data.connectionId) {
        localStorage.setItem("composio_pending_connection", data.connectionId);
        localStorage.setItem("composio_pending_toolkit", toolkit.toLowerCase());
      }

      // Handle OAuth redirect based on platform
      if (isMedian()) {
        // Store flag indicating OAuth is in progress
        localStorage.setItem("median_oauth_in_progress", "true");
        
        // Use Median's app browser to keep OAuth flow within app context
        const opened = median.window.open(data.redirectUrl, 'appbrowser');
        
        if (opened) {
          console.log("Opened OAuth in Median app browser");
          
          // Set up callback for when the app browser closes
          window.median_appbrowser_closed = async () => {
            console.log("Median app browser closed, checking connection...");
            const inProgress = localStorage.getItem("median_oauth_in_progress");
            
            if (inProgress) {
              // Give a small delay for any redirects to complete
              await new Promise(resolve => setTimeout(resolve, 800));
              
              const result = await completeConnection();
              if (result?.success) {
                console.log("OAuth completed successfully after app browser closed");
              } else {
                console.log("OAuth may not have completed, user might have cancelled");
                toast.info("Connection cancelled or incomplete");
              }
              setConnecting(false);
            }
          };
        } else {
          // Fallback if app browser isn't available
          console.log("Median app browser not available, using standard redirect");
          window.location.assign(data.redirectUrl);
        }
      } else {
        // Standard web redirect - use top-level window to escape iframe
        // This is needed because Composio blocks embedding in iframes
        const targetWindow = window.top || window;
        targetWindow.location.assign(data.redirectUrl);
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect integration");
      setConnecting(false);
    }
  }, [toolkit, completeConnection]);

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
        .single();

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
    completeConnection,
    disconnect,
    checkStatus,
  };
}
