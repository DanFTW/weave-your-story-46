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
  checking: boolean;
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
  const [checking, setChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // Refs for polling
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

      // --- SLACK: Native OAuth (bypass Composio) ---
      if (toolkit.toLowerCase() === "slack") {
        const isMobile = isMobileBrowser();
        const returnUrl = customRedirectPath 
          ? `${baseUrl}${customRedirectPath}`
          : `${baseUrl}/integration/slack`;
        if (isMobile) {
          localStorage.setItem('oauth_return_url', returnUrl);
        } else {
          sessionStorage.setItem('oauth_return_url', returnUrl);
        }

        const { data, error } = await supabase.functions.invoke("slack-oauth", {
          body: { action: "initiate" },
        });

        if (error || !data?.redirectUrl) {
          console.error("Slack OAuth initiate error:", error);
          toast.error("Failed to start Slack connection");
          setConnecting(false);
          return;
        }

        // Start polling for connection status
        startPolling();

        // Helper: open the OAuth URL in the appropriate context
        const openOAuthUrl = (url: string) => {
          if (isMedian()) {
            const opened = median.window.open(url, 'appbrowser');
            if (!opened) {
              stopPolling();
              window.location.assign(url);
            }
          } else if (isMobile) {
            stopPolling();
            window.location.assign(url);
          } else {
            const popup = window.open(url, 'slack_oauth', 'width=600,height=700');
            if (!popup || popup.closed) {
              stopPolling();
              window.location.assign(url);
            }
          }
        };

        // When forceReauth, sign out of Slack first to clear cached session cookies
        if (forceReauth) {
          const SIGNOUT_DELAY = 2000; // ms to wait for signout to process
          const slackSignoutUrl = 'https://slack.com/signout';

          if (isMedian()) {
            // Open signout in appbrowser, wait, close it, then open OAuth in fresh appbrowser
            median.window.open(slackSignoutUrl, 'appbrowser');
            setTimeout(() => {
              median.appbrowser.close();
              setTimeout(() => {
                openOAuthUrl(data.redirectUrl);
              }, 500);
            }, SIGNOUT_DELAY);
          } else if (!isMobile) {
            // Desktop: open signout in a popup, wait, then navigate it to OAuth URL
            const popup = window.open(slackSignoutUrl, 'slack_oauth', 'width=600,height=700');
            if (popup && !popup.closed) {
              setTimeout(() => {
                try {
                  popup.location.href = data.redirectUrl;
                } catch {
                  // Cross-origin navigation failed, close and reopen
                  popup.close();
                  openOAuthUrl(data.redirectUrl);
                }
              }, SIGNOUT_DELAY);
            } else {
              // Popup blocked — best-effort direct redirect
              openOAuthUrl(data.redirectUrl);
            }
          } else {
            // Mobile: can't do popup trick, best-effort direct redirect
            openOAuthUrl(data.redirectUrl);
          }
        } else {
          openOAuthUrl(data.redirectUrl);
        }
        return;
      }
      // --- END SLACK ---
      
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

      // Handle API Key auth (no redirect needed — connection is immediate)
      if (data.apiKeyAuth && data.connectionId) {
        console.log(`API Key auth completed for ${toolkit}, connectionId: ${data.connectionId}`);
        pendingConnectionIdRef.current = data.connectionId;
        // Immediately check connection status since no OAuth redirect is needed
        startPolling();
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
        // Desktop - try new tab first (less likely to be blocked than popup)
        const popup = window.open(data.redirectUrl, '_blank');

        if (!popup || popup.closed) {
          console.log("New tab blocked, trying popup window...");
          const popupWindow = window.open(
            data.redirectUrl, 'oauth_popup', 'width=600,height=700'
          );

          if (!popupWindow || popupWindow.closed) {
            console.log("All popups blocked, using top-level redirect");
            stopPolling();
            const targetWindow = window.top || window;
            targetWindow.location.assign(data.redirectUrl);
          }
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
    setChecking(true);
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
    } finally {
      setChecking(false);
    }
  }, [toolkit]);

  // Disconnect integration - revoke Composio connection + delete DB record
  const disconnect = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (toolkit.toLowerCase() === "slack") {
        // Slack: delete DB record and clear message monitor config
        await supabase
          .from("user_integrations")
          .delete()
          .eq("user_id", session.user.id)
          .eq("integration_id", "slack");

        // Clear Slack Message Monitor config so reconnect starts fresh
        await supabase
          .from("slack_messages_config" as any)
          .delete()
          .eq("user_id", session.user.id);
      } else {
        // Call edge function to revoke Composio connection and delete DB record
        const { error } = await supabase.functions.invoke("composio-disconnect", {
          body: { toolkit },
        });

        if (error) {
          console.error("Disconnect edge function error:", error);
          await supabase
            .from("user_integrations")
            .delete()
            .eq("user_id", session.user.id)
            .eq("integration_id", toolkit.toLowerCase());
        }
      }

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
    checking,
    isConnected,
    connect,
    disconnect,
    checkStatus,
  };
}
