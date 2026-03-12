import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isMedian, median } from "@/utils/median";
import { Loader2, CheckCircle2, XCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * OAuth completion page - handles the callback from OAuth providers.
 * This page runs in the App Browser context (Median) or browser tab.
 * It completes the connection and closes/redirects appropriately.
 * 
 * Composio v3 redirects here with `connected_account_id` parameter.
 * The toolkit is determined server-side from the Composio API response.
 */
export default function OAuthComplete() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing connection...");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [toolkit, setToolkit] = useState<string | null>(null);

  const handleRetry = () => {
    // Get the stored return URL to determine which integration to retry
    // Check both storage locations (mobile uses localStorage)
    const storedReturnUrl = 
      sessionStorage.getItem('oauth_return_url') || 
      localStorage.getItem('oauth_return_url');
    
    if (storedReturnUrl) {
      window.location.href = storedReturnUrl;
    } else {
      // Fallback to integrations page
      navigate('/integrations');
    }
  };

  const handleGoBack = () => {
    navigate('/integrations');
  };

  // Invoke callback with retry logic for transient errors
  async function invokeCallbackWithRetry(
    connectionId: string,
    userId: string | undefined,
    toolkitParam: string | null,
    retries = 0
  ): Promise<{ data: any; error: any }> {
    try {
      const result = await supabase.functions.invoke("composio-callback", {
        body: {
          connectionId,
          userId,
          toolkit: toolkitParam,
        },
      });
      return result;
    } catch (err) {
      // Retry on AbortError (network interruption) up to MAX_RETRIES
      const isAbortError = err instanceof DOMException && err.name === "AbortError";
      const isNetworkError = err instanceof TypeError && err.message.includes("fetch");
      
      if (retries < MAX_RETRIES && (isAbortError || isNetworkError)) {
        console.log(`Retry attempt ${retries + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retries + 1)));
        return invokeCallbackWithRetry(connectionId, userId, toolkitParam, retries + 1);
      }
      throw err;
    }
  }

  useEffect(() => {
    const completeOAuth = async () => {
      console.log("OAuthComplete: Full URL:", window.location.href);
      console.log("OAuthComplete: Parsed params:", Object.fromEntries(searchParams.entries()));

      // --- SLACK NATIVE OAUTH CALLBACK ---
      const slackCode = searchParams.get("code");
      const stateParam = searchParams.get("state");
      const isSlackCallback = slackCode && stateParam?.startsWith("slack_");

      if (isSlackCallback) {
        console.log("OAuthComplete: Slack native OAuth callback detected");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke("slack-oauth", {
            body: {
              action: "callback",
              code: slackCode,
              userId: session?.user?.id,
            },
          });

          console.log("OAuthComplete: Slack callback response:", data, error);

          if (error || !data?.success) {
            setStatus("error");
            setMessage("Failed to complete Slack connection");
            setErrorDetails(data?.error || error?.message || "Please try again.");
            return;
          }

          // Success — continue to normal success handling below
          setToolkit("slack");
          setStatus("success");
          setMessage("Slack connected successfully!");

          // Handle redirect
          const isPopup = window.opener && window.opener !== window;
          if (isMedian()) {
            setTimeout(() => { try { median.appbrowser.close(); } catch (e) { setMessage("Connection complete! You can close this window."); } }, 1500);
          } else if (isPopup) {
            setTimeout(() => { try { window.close(); } catch (e) { setMessage("Connection complete! You can close this window."); } }, 2000);
          } else {
            setTimeout(() => {
              const storedReturnUrl = sessionStorage.getItem('oauth_return_url') || localStorage.getItem('oauth_return_url');
              sessionStorage.removeItem('oauth_return_url');
              localStorage.removeItem('oauth_return_url');
              window.location.href = storedReturnUrl || `${window.location.origin}/integration/slack`;
            }, 1500);
          }
          return;
        } catch (err) {
          console.error("OAuthComplete: Slack callback error:", err);
          setStatus("error");
          setMessage("Failed to complete Slack connection");
          setErrorDetails(err instanceof Error ? err.message : "Please try again.");
          return;
        }
      }
      // --- END SLACK ---

      // Composio v3 uses 'connected_account_id' in callback
      const connectionId = 
        searchParams.get("connected_account_id") || 
        searchParams.get("connectionId") ||
        searchParams.get("id");
      
      const toolkitFromUrl = searchParams.get("toolkit");

      console.log("OAuthComplete: connectionId =", connectionId, "toolkit =", toolkitFromUrl);

      if (!connectionId) {
        console.error("OAuthComplete: No connection ID found in URL params");
        setStatus("error");
        const allParams = Object.fromEntries(searchParams.entries());
        const paramStr = Object.keys(allParams).length > 0 
          ? `Received: ${JSON.stringify(allParams)}`
          : "No query parameters received.";
        setMessage("Connection incomplete");
        setErrorDetails(paramStr);
        return;
      }

      try {
        // Get the current session - may be null in Median App Browser
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log("OAuthComplete: Session available:", !!session);

        // Call the callback edge function with retry logic
        const { data, error } = await invokeCallbackWithRetry(
          connectionId,
          session?.user?.id,
          toolkitFromUrl
        );

        console.log("OAuthComplete: Callback response:", data, error);

        if (error) {
          console.error("OAuthComplete: Callback error:", error);
          setStatus("error");
          setMessage("Failed to complete connection");
          setErrorDetails(error.message || "Please try again.");
          return;
        }

        if (data?.success) {
          const resolvedToolkit = data.toolkit || toolkitFromUrl || "integration";
          setToolkit(resolvedToolkit);
          setStatus("success");
          setMessage(`${resolvedToolkit.charAt(0).toUpperCase() + resolvedToolkit.slice(1)} connected successfully!`);

          // Check if this is a popup window
          const isPopup = window.opener && window.opener !== window;
          
          // If we're in the Median App Browser, close it
          if (isMedian()) {
            console.log("OAuthComplete: In Median, attempting to close app browser...");
            // Give user a moment to see success message
            setTimeout(() => {
              try {
                median.appbrowser.close();
              } catch (e) {
                console.log("OAuthComplete: Failed to close app browser:", e);
                setMessage("Connection complete! You can close this window.");
              }
            }, 1500);
          } else if (isPopup) {
            // Popup flow - parent window will detect via polling
            console.log("OAuthComplete: In popup, will close after showing success");
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                console.log("OAuthComplete: Failed to close popup:", e);
                setMessage("Connection complete! You can close this window.");
              }
            }, 2000);
          } else {
            // Full redirect flow - use stored return URL or construct from toolkit
            setTimeout(() => {
              // Check both storage locations (mobile uses localStorage)
              const storedReturnUrl = 
                sessionStorage.getItem('oauth_return_url') || 
                localStorage.getItem('oauth_return_url');
              
              // Clean up both storage locations
              sessionStorage.removeItem('oauth_return_url');
              localStorage.removeItem('oauth_return_url');
              
              if (storedReturnUrl) {
                console.log("OAuthComplete: Redirecting to stored URL:", storedReturnUrl);
                window.location.href = storedReturnUrl;
              } else {
                const redirectPath = `/integration/${resolvedToolkit.toLowerCase()}`;
                console.log("OAuthComplete: Redirecting to:", `${window.location.origin}${redirectPath}`);
                window.location.href = `${window.location.origin}${redirectPath}`;
              }
            }, 1500);
          }
        } else {
          setStatus("error");
          setMessage("Connection failed");
          setErrorDetails(data?.error || data?.message || "Please try again.");
        }
      } catch (err) {
        console.error("OAuthComplete: Unexpected error:", err);
        setStatus("error");
        
        // Handle specific error types with friendly messages
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessage("Connection was interrupted");
          setErrorDetails("The connection process was interrupted. This can happen on slow networks or if the page was closed. Please try again.");
        } else if (err instanceof TypeError && err.message.includes("fetch")) {
          setMessage("Network error");
          setErrorDetails("Could not reach the server. Please check your internet connection and try again.");
        } else {
          setMessage("An unexpected error occurred");
          setErrorDetails(err instanceof Error ? err.message : "Please try again.");
        }
      }
    };

    completeOAuth();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-sm">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
            <p className="text-lg text-muted-foreground">{message}</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
            <p className="text-lg text-foreground font-medium">{message}</p>
            {isMedian() ? (
              <p className="text-sm text-muted-foreground">Returning to app...</p>
            ) : (
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            )}
          </>
        )}
        
        {status === "error" && (
          <>
            {message === "Network error" ? (
              <WifiOff className="w-12 h-12 mx-auto text-destructive" />
            ) : (
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
            )}
            <p className="text-lg text-foreground font-medium">{message}</p>
            {errorDetails && (
              <p className="text-sm text-muted-foreground">{errorDetails}</p>
            )}
            <div className="flex flex-col gap-2 pt-4">
              <Button onClick={handleRetry} className="w-full gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
              <Button variant="outline" onClick={handleGoBack} className="w-full">
                Back to Integrations
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
