import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { getIntegrationDetail } from "@/data/integrations";
import { IntegrationGradientBackground } from "@/components/integrations/IntegrationGradientBackground";
import { IntegrationLargeIcon } from "@/components/integrations/IntegrationLargeIcon";
import { IntegrationConnectButton } from "@/components/integrations/IntegrationConnectButton";
import { IntegrationCapabilityTag } from "@/components/integrations/IntegrationCapabilityTag";
import { IntegrationConnectedAccount } from "@/components/integrations/IntegrationConnectedAccount";
import { IntegrationDoneButton } from "@/components/integrations/IntegrationDoneButton";

// Mock connected account data - will be replaced with real data from OAuth
interface ConnectedAccount {
  avatarUrl?: string;
  name: string;
  email: string;
}

export default function IntegrationDetail() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  
  // For demo purposes, toggle between connected/disconnected states
  const [isConnected, setIsConnected] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState<ConnectedAccount | null>(null);

  const integration = integrationId ? getIntegrationDetail(integrationId) : undefined;

  if (!integration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Integration not found</p>
      </div>
    );
  }

  const handleConnect = () => {
    // TODO: Implement actual OAuth flow
    // For now, simulate a successful connection
    setIsConnected(true);
    setConnectedAccount({
      name: "Mari Kondo",
      email: "doesitbringjoy@domain.com",
      avatarUrl: undefined, // Will show initials fallback
    });
  };

  const handleChangeAccount = () => {
    // TODO: Implement account change flow
    console.log("Change account");
  };

  const handleDone = () => {
    navigate("/integrations");
  };

  const handleBack = () => {
    navigate("/integrations");
  };

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
                name={connectedAccount.name}
                email={connectedAccount.email}
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
      </motion.div>
    </div>
  );
}
