import { Plus } from "lucide-react";
import { FlowConfig } from "@/types/flows";
import { ThreadSplash } from "@/components/thread/ThreadSplash";
import { motion } from "framer-motion";

interface FlowOverviewProps {
  config: FlowConfig;
  onAddEntry: () => void;
}

export function FlowOverview({ config, onAddEntry }: FlowOverviewProps) {
  return (
    <div className="min-h-screen bg-background">
      <ThreadSplash
        title={config.title}
        icon={config.icon}
        gradient={config.gradient}
        subtitle={config.subtitle}
      />
      
      <div className="px-5 pt-4">
        {/* Description */}
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {config.subtitle}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* Add Entry Card */}
        <motion.button
          onClick={onAddEntry}
          className="w-full bg-card rounded-2xl p-6 shadow-sm border border-border border-dashed flex flex-col items-center justify-center gap-3 hover:border-primary/30 transition-colors"
          whileTap={{ scale: 0.98 }}
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="w-7 h-7 text-primary" />
          </div>
          <span className="text-base font-medium text-foreground">
            Add {config.entryName}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
