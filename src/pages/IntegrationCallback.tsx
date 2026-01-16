import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CallbackStatus = "loading" | "success" | "error";

export default function IntegrationCallback() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [message, setMessage] = useState("Completing connection...");

  useEffect(() => {
    async function processCallback() {
      if (!integrationId) {
        setStatus("error");
        setMessage("Invalid integration");
        return;
      }

      try {
        // Get pending connection ID from session storage
        const pendingConnectionId = sessionStorage.getItem(`pending_connection_${integrationId}`);
        
        // Check for error in URL params (some OAuth providers pass errors this way)
        const errorParam = searchParams.get("error");
        if (errorParam) {
          console.error("OAuth error:", errorParam);
          setStatus("error");
          setMessage("Connection was denied or failed");
          sessionStorage.removeItem(`pending_connection_${integrationId}`);
          
          setTimeout(() => {
            navigate(`/integration/${integrationId}`, { replace: true });
          }, 2000);
          return;
        }

        // Check connection status with our edge function
        const { data, error } = await supabase.functions.invoke("composio-auth", {
          body: {
            action: "status",
            connectionId: pendingConnectionId,
            integrationId,
          },
        });

        if (error) {
          console.error("Error checking status:", error);
          setStatus("error");
          setMessage("Failed to verify connection");
        } else if (data?.isConnected) {
          setStatus("success");
          setMessage("Connected successfully!");
          sessionStorage.removeItem(`pending_connection_${integrationId}`);
          
          // Redirect to integration detail page after brief success message
          setTimeout(() => {
            navigate(`/integration/${integrationId}`, { replace: true });
          }, 1500);
        } else if (data?.status === "pending") {
          // Still pending - might need to wait
          setMessage("Waiting for authorization...");
          
          // Poll a few times
          let attempts = 0;
          const maxAttempts = 5;
          
          const pollInterval = setInterval(async () => {
            attempts++;
            
            const { data: pollData } = await supabase.functions.invoke("composio-auth", {
              body: {
                action: "status",
                connectionId: pendingConnectionId,
                integrationId,
              },
            });

            if (pollData?.isConnected) {
              clearInterval(pollInterval);
              setStatus("success");
              setMessage("Connected successfully!");
              sessionStorage.removeItem(`pending_connection_${integrationId}`);
              
              setTimeout(() => {
                navigate(`/integration/${integrationId}`, { replace: true });
              }, 1500);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              setStatus("error");
              setMessage("Connection timed out. Please try again.");
              
              setTimeout(() => {
                navigate(`/integration/${integrationId}`, { replace: true });
              }, 2000);
            }
          }, 2000);
          
          return () => clearInterval(pollInterval);
        } else {
          setStatus("error");
          setMessage("Connection failed. Please try again.");
          
          setTimeout(() => {
            navigate(`/integration/${integrationId}`, { replace: true });
          }, 2000);
        }
      } catch (err) {
        console.error("Callback processing error:", err);
        setStatus("error");
        setMessage("Something went wrong");
        
        setTimeout(() => {
          navigate(`/integration/${integrationId}`, { replace: true });
        }, 2000);
      }
    }

    processCallback();
  }, [integrationId, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        {status === "loading" && (
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        )}
        {status === "success" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <CheckCircle className="w-12 h-12 text-green-500" />
          </motion.div>
        )}
        {status === "error" && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <XCircle className="w-12 h-12 text-destructive" />
          </motion.div>
        )}
        
        <p className="text-lg font-medium text-foreground">{message}</p>
        
        {status === "loading" && (
          <p className="text-sm text-muted-foreground">
            Please wait while we complete your connection...
          </p>
        )}
      </motion.div>
    </div>
  );
}
