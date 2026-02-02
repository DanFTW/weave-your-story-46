import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type FlowModeFilter = "all" | "thread" | "flow" | "dump";

interface ThreadFilterBarProps {
  flowModeFilter: FlowModeFilter;
  searchQuery: string;
  onFlowModeChange: (mode: FlowModeFilter) => void;
  onSearchChange: (query: string) => void;
}

const flowModeOptions: { id: FlowModeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "thread", label: "Threads" },
  { id: "flow", label: "Flows" },
  { id: "dump", label: "Dumps" },
];

export function ThreadFilterBar({
  flowModeFilter,
  searchQuery,
  onFlowModeChange,
  onSearchChange,
}: ThreadFilterBarProps) {
  return (
    <div className="space-y-3">
      {/* Filter Pills - TOP */}
      <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
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

      {/* Search Bar - BELOW */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search threads..."
          className="pl-10 pr-10 h-11 rounded-xl text-sm bg-secondary/50 border-0"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
