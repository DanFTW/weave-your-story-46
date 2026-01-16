import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isMedian, median } from "@/utils/median";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * OAuth completion page - handles the callback from OAuth providers.
 * This page runs in the App Browser context (Median) or browser tab.
 * It completes the connection and closes/redirects appropriately.
 */
export default function OAuthComplete() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completing connection...");

  useEffect(() => {
    const completeOAuth = async () => {
      const connectionId = searchParams.get("connectionId");
      const toolkit = searchParams.get("toolkit");

      console.log("OAuthComplete: connectionId =", connectionId, "toolkit =", toolkit);

      if (!connectionId || !toolkit) {
        setStatus("error");
        setMessage("Missing connection parameters");
        return;
      }

      try {
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No session in OAuthComplete - this is expected in App Browser");
          // In Median App Browser, we won't have a session because it's an isolated context
          // The edge function will use service role to update the connection
        }

        // Call the callback edge function to complete the connection
        const { data, error } = await supabase.functions.invoke("composio-callback", {
          body: {
            connectionId,
            userId: session?.user?.id, // May be null in App Browser
            toolkit: toolkit.toLowerCase(),
          },
        });

        console.log("OAuthComplete callback response:", data, error);

        if (error) {
          console.error("Callback error:", error);
          setStatus("error");
          setMessage("Failed to complete connection");
          return;
        }

        if (data?.success) {
          setStatus("success");
          setMessage(`${toolkit} connected successfully!`);

          // If we're in the Median App Browser, close it
          if (isMedian()) {
            console.log("In Median, attempting to close app browser...");
            // Give user a moment to see success message
            setTimeout(() => {
              const closed = median.appbrowser.close();
              if (!closed) {
                console.log("Failed to close app browser, showing manual close message");
                setMessage("Connection complete! You can close this window.");
              }
            }, 1500);
          } else {
            // In regular browser, redirect back to the integration page
            setTimeout(() => {
              const redirectPath = `/integration/${toolkit.toLowerCase()}`;
              window.location.href = `${window.location.origin}${redirectPath}`;
            }, 1500);
          }
        } else {
          setStatus("error");
          setMessage(data?.error || "Connection failed");
        }
      } catch (err) {
        console.error("OAuthComplete error:", err);
        setStatus("error");
        setMessage("An error occurred");
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
            {isMedian() && (
              <p className="text-sm text-muted-foreground">Returning to app...</p>
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
