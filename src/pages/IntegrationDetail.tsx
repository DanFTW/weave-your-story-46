import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getIntegrationDetail } from "@/data/integrations";
import { IntegrationGradientBackground } from "@/components/integrations/IntegrationGradientBackground";
import { IntegrationLargeIcon } from "@/components/integrations/IntegrationLargeIcon";
import { IntegrationConnectButton } from "@/components/integrations/IntegrationConnectButton";
import { IntegrationCapabilityTag } from "@/components/integrations/IntegrationCapabilityTag";
import { IntegrationConnectedAccount } from "@/components/integrations/IntegrationConnectedAccount";
import { IntegrationDoneButton } from "@/components/integrations/IntegrationDoneButton";
import { OAuthConfirmDialog } from "@/components/integrations/OAuthConfirmDialog";
import { ApiKeyCredentialForm, getApiKeyFields, getApiKeyHelpUrl } from "@/components/integrations/ApiKeyCredentialForm";
import { useComposio } from "@/hooks/useComposio";
import { useIOSContacts, isDespiaIOS } from "@/hooks/useIOSContacts";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationDetail() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmittingCredentials, setIsSubmittingCredentials] = useState(false);
  
  const isIOSContacts = integrationId === "ios-contacts";
  
  const integration = integrationId ? getIntegrationDetail(integrationId) : undefined;
  
  // Use the appropriate hook based on integration type
  const iosContacts = useIOSContacts();
  const composio = useComposio(isIOSContacts ? "__unused__" : (integrationId || "gmail"));
  
  const hook = isIOSContacts ? iosContacts : composio;
  const {
    connectedAccount,
    connecting,
    isConnected,
    connect,
    disconnect,
    checkStatus,
  } = hook;
  const checking = 'checking' in hook ? (hook as any).checking : false;

  // Track if we've already handled the return redirect
  const hasHandledReturn = useRef(false);

  // Check existing status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Check for return path after connection becomes active (generic for all integrations)
  useEffect(() => {
    if (isConnected && !hasHandledReturn.current && integrationId) {
      // Build the return path key using capitalized integration name
      // e.g., 'gmail' -> 'returnAfterGmailConnect', 'trello' -> 'returnAfterTrelloConnect'
      const capitalizedId = integrationId.charAt(0).toUpperCase() + integrationId.slice(1).toLowerCase();
      const returnPathKey = `returnAfter${capitalizedId}Connect`;
      const returnPath = sessionStorage.getItem(returnPathKey);
      
      if (returnPath) {
        hasHandledReturn.current = true;
        sessionStorage.removeItem(returnPathKey);
        // Small delay to show connection success before redirecting
        setTimeout(() => {
          navigate(returnPath);
        }, 500);
      }
    }
  }, [isConnected, integrationId, navigate]);

  // Legacy OAuth callback handling removed - now using /oauth-complete page with database polling
  // The useComposio hook polls the database for connection status changes

  // Legacy localStorage-based completion handling removed
  // Connection status is now detected via database polling in useComposio hook

  if (!integration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Integration not found</p>
      </div>
    );
  }

  const handleConnect = async () => {
    if (isIOSContacts) {
      // Direct native bridge call — no OAuth dialog needed
      try {
        await connect();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Connection failed";
        toast({
          title: "Connection failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmConnect = async () => {
    try {
      await connect(`/integration/${integrationId}`, false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Connection failed";
      toast({
        title: "Connection failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleChangeAccount = async () => {
    // Show toast about the switching process
    toast({
      title: "Switching accounts",
      description: "Disconnecting current account and starting fresh login...",
    });
    
    await disconnect();
    
    // Small delay to ensure Composio revocation completes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Start fresh connection with force reauth
    await connect(`/integration/${integrationId}`, true);
  };

  const handleDone = () => {
    navigate("/integrations");
  };

  const handleBack = () => {
    navigate("/integrations");
  };

  const isLoading = connecting || checking;

  const returnUrl = `${window.location.origin}/integration/${integrationId}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* OAuth Confirmation Dialog */}
      <OAuthConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        integrationName={integration.name}
        integrationIcon={integration.icon}
        onConfirm={handleConfirmConnect}
        returnUrl={returnUrl}
      />
      {/* Gradient Header Section */}
      <div className="relative h-64 flex-shrink-0">
        <IntegrationGradientBackground colors={integration.gradientColors} />

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleBack}
          className="absolute left-5 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
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
            <p className="text-muted-foreground">Connecting...</p>
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
                    email={connectedAccount.email || ""}
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
                {/* Disconnected State: Connect Button or iOS-only message */}
                <div className="mt-8">
                  {isIOSContacts && !isDespiaIOS ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <Smartphone className="w-10 h-10 text-muted-foreground" />
                      <p className="text-muted-foreground text-sm">
                        This integration is only available in the iOS app.
                      </p>
                    </div>
                  ) : (
                    <IntegrationConnectButton onClick={handleConnect} />
                  )}
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
