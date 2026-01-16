import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { getIntegrationDetail } from "@/data/integrations";
import { IntegrationGradientBackground } from "@/components/integrations/IntegrationGradientBackground";
import { IntegrationLargeIcon } from "@/components/integrations/IntegrationLargeIcon";
import { IntegrationConnectButton } from "@/components/integrations/IntegrationConnectButton";
import { IntegrationCapabilityTag } from "@/components/integrations/IntegrationCapabilityTag";

export default function IntegrationDetail() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();

  const integration = integrationId ? getIntegrationDetail(integrationId) : undefined;

  if (!integration) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Integration not found</p>
      </div>
    );
  }

  const isConnected = integration.status === "connected";

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
          onClick={() => navigate(-1)}
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
        className="flex-1 bg-card rounded-t-3xl -mt-6 relative z-10 px-6 pt-8 pb-safe-bottom"
      >
        {/* Details Section */}
        <section>
          <h2 className="text-2xl font-bold text-foreground mb-3">Details</h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {integration.description}
          </p>
        </section>

        {/* Connect Button */}
        <div className="mt-8">
          <IntegrationConnectButton
            isConnected={isConnected}
            onClick={() => {
              // TODO: Implement OAuth flow
              console.log(`Connect to ${integration.id}`);
            }}
          />
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
      </motion.div>
    </div>
  );
}
