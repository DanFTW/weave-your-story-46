import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isMedian, median } from "@/utils/median";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

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
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing connection...");
  const [toolkit, setToolkit] = useState<string | null>(null);

  useEffect(() => {
    const completeOAuth = async () => {
      // Log the full URL for debugging
      console.log("OAuthComplete: Full URL:", window.location.href);
      console.log("OAuthComplete: Search string:", window.location.search);
      console.log("OAuthComplete: Hash:", window.location.hash);
      
      // Composio v3 uses 'connected_account_id' in callback
      // Also check alternative param names for flexibility
      const connectionId = 
        searchParams.get("connected_account_id") || 
        searchParams.get("connectionId") ||
        searchParams.get("id");
      
      // Toolkit might be in URL (if Composio preserved it) or will be fetched from API
      const toolkitFromUrl = searchParams.get("toolkit");

      console.log("OAuthComplete: Parsed params:", Object.fromEntries(searchParams.entries()));
      console.log("OAuthComplete: connectionId =", connectionId, "toolkit =", toolkitFromUrl);

      if (!connectionId) {
        console.error("OAuthComplete: No connection ID found in URL params");
        console.error("OAuthComplete: Expected format: /oauth-complete?connected_account_id=ca_xxx");
        setStatus("error");
        // More descriptive error message
        const allParams = Object.fromEntries(searchParams.entries());
        const paramStr = Object.keys(allParams).length > 0 
          ? `Received params: ${JSON.stringify(allParams)}`
          : "No query parameters received from OAuth provider.";
        setMessage(`Connection incomplete. ${paramStr}`);
        return;
      }

      try {
        // Get the current session - may be null in Median App Browser
        const { data: { session } } = await supabase.auth.getSession();
        
        console.log("OAuthComplete: Session available:", !!session);

        // Call the callback edge function to complete the connection
        // The edge function will fetch toolkit info from Composio if not provided
        const { data, error } = await supabase.functions.invoke("composio-callback", {
          body: {
            connectionId,
            userId: session?.user?.id, // May be null in App Browser - edge function handles this
            toolkit: toolkitFromUrl, // May be null - edge function will fetch from Composio
          },
        });

        console.log("OAuthComplete: Callback response:", data, error);

        if (error) {
          console.error("OAuthComplete: Callback error:", error);
          setStatus("error");
          setMessage("Failed to complete connection. Please try again.");
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
              const storedReturnUrl = sessionStorage.getItem('oauth_return_url');
              sessionStorage.removeItem('oauth_return_url');
              
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
          setMessage(data?.error || data?.message || "Connection failed. Please try again.");
        }
      } catch (err) {
        console.error("OAuthComplete: Unexpected error:", err);
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    };

    completeOAuth();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
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
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <p className="text-lg text-foreground font-medium">{message}</p>
            <p className="text-sm text-muted-foreground">
              Please close this window and try again.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
