import { motion } from "framer-motion";
import { integrationSections } from "@/data/integrations";
import { IntegrationSection } from "@/components/integrations/IntegrationSection";

export default function Integrations() {
  return (
    <div className="pb-nav">
      <div className="px-5">
        {/* Page Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-safe-top pb-6"
        >
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Integrations
          </h1>
        </motion.header>

        {/* Integration Sections */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-8"
        >
          {integrationSections.map((section) => (
            <IntegrationSection key={section.title} section={section} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
