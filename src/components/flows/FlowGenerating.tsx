import { Loader2 } from "lucide-react";
import { FlowConfig } from "@/types/flows";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FlowGeneratingProps {
  config: FlowConfig;
  entryCount: number;
}

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function FlowGenerating({ config, entryCount }: FlowGeneratingProps) {
  const Icon = config.icon;

  return (
    <div className={cn("min-h-screen flex flex-col items-center justify-center px-8", gradientClasses[config.gradient])}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-white" strokeWidth={1.5} />
        </div>

        {/* Loading spinner */}
        <div className="mb-6">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>

        {/* Text */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Generating Memories
        </h1>
        <p className="text-white/80 text-base">
          Creating memories for {entryCount} {entryCount === 1 ? config.entryName : config.entryNamePlural}...
        </p>
      </motion.div>
    </div>
  );
}
