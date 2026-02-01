import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FlowModeFilter = "all" | "thread" | "dump";
type TriggerFilter = "all" | "automatic" | "manual";

interface ThreadFilterBarProps {
  flowModeFilter: FlowModeFilter;
  triggerFilter: TriggerFilter;
  onFlowModeChange: (mode: FlowModeFilter) => void;
  onTriggerChange: (trigger: TriggerFilter) => void;
}

const flowModeOptions: { id: FlowModeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "thread", label: "Threads" },
  { id: "dump", label: "Dumps" },
];

const triggerOptions: { id: TriggerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "automatic", label: "Auto" },
  { id: "manual", label: "Manual" },
];

export function ThreadFilterBar({
  flowModeFilter,
  triggerFilter,
  onFlowModeChange,
  onTriggerChange,
}: ThreadFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Flow Mode Filter Group */}
      <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
        {flowModeOptions.map((option) => {
          const isActive = flowModeFilter === option.id;
          return (
            <motion.button
              key={option.id}
              onClick={() => onFlowModeChange(option.id)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="flowModeActive"
                  className="absolute inset-0 bg-background rounded-lg shadow-sm"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border/50" />

      {/* Trigger Type Filter Group */}
      <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl">
        {triggerOptions.map((option) => {
          const isActive = triggerFilter === option.id;
          return (
            <motion.button
              key={option.id}
              onClick={() => onTriggerChange(option.id)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="triggerActive"
                  className="absolute inset-0 bg-background rounded-lg shadow-sm"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
