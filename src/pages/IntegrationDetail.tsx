import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getIntegrationDetail } from "@/data/integrations";
import { IntegrationGradientBackground } from "@/components/integrations/IntegrationGradientBackground";
import { IntegrationLargeIcon } from "@/components/integrations/IntegrationLargeIcon";
import { IntegrationConnectButton } from "@/components/integrations/IntegrationConnectButton";
import { IntegrationCapabilityTag } from "@/components/integrations/IntegrationCapabilityTag";
import { IntegrationConnectedAccount } from "@/components/integrations/IntegrationConnectedAccount";
import { IntegrationDoneButton } from "@/components/integrations/IntegrationDoneButton";
import { useComposio } from "@/hooks/useComposio";
import { isMedian, median } from "@/utils/median";

export default function IntegrationDetail() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);
  
  const integration = integrationId ? getIntegrationDetail(integrationId) : undefined;
  
  const {
    connectedAccount,
    connecting,
    isConnected,
    connect,
    completeConnection,
    disconnect,
    checkStatus,
  } = useComposio(integrationId || "gmail");

  // Check existing status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Handle OAuth callback when ?connected=true is in URL
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected === "true" && !isProcessingCallback) {
      setIsProcessingCallback(true);
      
      // If we're in Median App Browser, close immediately and let main webview handle completion
      // The App Browser has a separate session context, so we can't complete OAuth here
      if (isMedian()) {
        console.log("OAuth callback detected in Median App Browser - closing and signaling main webview");
        
        // Store a flag that main webview can check
        localStorage.setItem("oauth_completed_callback", integrationId || "gmail");
        
        // Close the app browser - this returns to main webview
        median.appbrowser.close();
        return;
      }
      
      // Standard web flow - complete the connection with retry logic
      const completeWithRetry = async (retries = 3): Promise<boolean> => {
        const result = await completeConnection();
        
        if (result?.success) {
          return true;
        }
        
        // Retry if not immediately successful (Composio webhook delay)
        if (retries > 0) {
          console.log(`Connection not ready, retrying... (${retries} attempts left)`);
          await new Promise(r => setTimeout(r, 1000));
          return completeWithRetry(retries - 1);
        }
        
        return false;
      };
      
      completeWithRetry().then(async () => {
        // Remove the query param from URL
        navigate(`/integration/${integrationId}`, { replace: true });
        setIsProcessingCallback(false);
      });
    }
  }, [searchParams, integrationId, completeConnection, navigate, isProcessingCallback]);

  // Handle completion after Median App Browser closes (main webview context)
  useEffect(() => {
    const checkOAuthCompletion = async () => {
      const completedToolkit = localStorage.getItem("oauth_completed_callback");
      
      if (completedToolkit && completedToolkit === integrationId) {
        console.log("Main webview detected OAuth completion signal, completing connection...");
        localStorage.removeItem("oauth_completed_callback");
        setIsProcessingCallback(true);
        
        // Complete with retry in main webview which has the session
        const completeWithRetry = async (retries = 5): Promise<boolean> => {
          const result = await completeConnection();
          
          if (result?.success) {
            return true;
          }
          
          if (retries > 0) {
            console.log(`Connection not ready, retrying... (${retries} attempts left)`);
            await new Promise(r => setTimeout(r, 1000));
            return completeWithRetry(retries - 1);
          }
          
          return false;
        };
        
        await completeWithRetry();
        setIsProcessingCallback(false);
      }
    };
    
    // Check immediately
    checkOAuthCompletion();
    
    // Also listen for focus events (when app browser closes, main webview regains focus)
    const handleFocus = () => {
      checkOAuthCompletion();
    };
    
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [integrationId, completeConnection]);

  if (!integration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Integration not found</p>
      </div>
    );
  }

  const handleConnect = async () => {
    await connect(`/integration/${integrationId}`);
  };

  const handleChangeAccount = async () => {
    await disconnect();
    await connect(`/integration/${integrationId}`);
  };

  const handleDone = () => {
    navigate("/integrations");
  };

  const handleBack = () => {
    navigate("/integrations");
  };

  const isLoading = connecting || isProcessingCallback;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Gradient Header Section */}
      <div className="relative h-64 flex-shrink-0">
        <IntegrationGradientBackground colors={integration.gradientColors} />

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleBack}
          className="absolute top-12 left-5 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </motion.button>

        {/* Icon and Title */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <IntegrationLargeIcon icon={integration.icon} />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-4 text-xl font-semibold text-white drop-shadow-md"
          >
            {integration.name}
          </motion.h1>
        </div>
      </div>

      {/* Content Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex-1 bg-card rounded-t-3xl -mt-6 relative z-10 px-6 pt-8 pb-8 flex flex-col"
      >
        {/* Loading State */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-muted-foreground">
              {isProcessingCallback ? "Completing connection..." : "Connecting..."}
            </p>
          </div>
        ) : (
          <>
            {/* Details Section */}
            <section>
              <h2 className="text-2xl font-bold text-foreground mb-3">Details</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {integration.description}
              </p>
            </section>

            {/* Connected State: Account Section */}
            {isConnected && connectedAccount ? (
              <>
                <div className="mt-8">
                  <IntegrationConnectedAccount
                    avatarUrl={connectedAccount.avatarUrl}
                    name={connectedAccount.name || "Connected Account"}
                    email={connectedAccount.email || "Email not available"}
                    onChangeAccount={handleChangeAccount}
                  />
                </div>

                {/* Divider */}
                <div className="my-6 border-t border-border" />

                {/* Capabilities Section */}
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Capabilities</h2>
                  <div className="flex flex-wrap gap-2">
                    {integration.capabilities.map((capability) => (
                      <IntegrationCapabilityTag key={capability} label={capability} />
                    ))}
                  </div>
                </section>

                {/* Associated threads (placeholder) */}
                <section className="mt-6">
                  <h2 className="text-lg font-semibold text-muted-foreground/60 mb-4">Associated threads</h2>
                  {/* Threads will be added here */}
                </section>

                {/* Spacer to push button to bottom */}
                <div className="flex-1 min-h-8" />

                {/* Done Button */}
                <div className="mt-auto">
                  <IntegrationDoneButton onClick={handleDone} />
                </div>
              </>
            ) : (
              <>
                {/* Disconnected State: Connect Button */}
                <div className="mt-8">
                  <IntegrationConnectButton onClick={handleConnect} />
                </div>

                {/* Divider */}
                <div className="my-8 border-t border-border" />

                {/* Capabilities Section */}
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Capabilities</h2>
                  <div className="flex flex-wrap gap-2">
                    {integration.capabilities.map((capability) => (
                      <IntegrationCapabilityTag key={capability} label={capability} />
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
