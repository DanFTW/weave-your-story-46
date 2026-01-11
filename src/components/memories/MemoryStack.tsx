import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { Memory } from "@/types/memory";
import { MemoryCard, getCategoryConfig } from "./MemoryCard";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface MemoryStackProps {
  memories: Memory[];
  category: string;
  index: number;
}

export function MemoryStack({ memories, category, index }: MemoryStackProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getCategoryConfig(category);
  const Icon = config.icon;
  const count = memories.length;
  
  const previewMemory = memories[0];
  const previewContent = previewMemory.content.length > 100 
    ? previewMemory.content.substring(0, 100) + '...' 
    : previewMemory.content;
  
  const timestamp = (() => {
    try {
      return format(parseISO(previewMemory.createdAt), "h:mm a");
    } catch {
      return "";
    }
  })();

  if (count === 1) {
    return <MemoryCard memory={memories[0]} index={index} />;
  }

  return (
    <div className="relative">
      {/* Collapsed stack view */}
      <div 
        className={cn(
          "cursor-pointer",
          isExpanded && "hidden"
        )}
        onClick={() => setIsExpanded(true)}
      >
        {/* Stacked cards behind */}
        {count >= 3 && (
          <div 
            className="absolute left-2 right-2 top-2.5 h-full rounded-2xl bg-card/50 border border-border/15"
            style={{ zIndex: 1 }}
          />
        )}
        {count >= 2 && (
          <div 
            className="absolute left-1 right-1 top-1 h-full rounded-2xl bg-card/70 border border-border/20"
            style={{ zIndex: 2 }}
          />
        )}
        
        {/* Main collapsed card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="relative rounded-2xl bg-card overflow-hidden border border-border/30 shadow-sm"
          style={{ zIndex: 3 }}
        >
          {/* Compact header */}
          <div className={cn("px-3 py-2", config.gradient)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/20">
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-xs font-semibold text-white">
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/70">{timestamp}</span>
                <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5">
                  <span className="text-xs font-bold text-white">{count}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-3 py-3">
            <p className="text-sm text-foreground leading-relaxed mb-2.5">
              {previewContent}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-2.5 w-2.5" />
                Synced
              </span>
              
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="text-xs">Tap to expand</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="space-y-2.5">
          {/* Collapse header */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
            <span>Collapse {count} memories</span>
          </button>
          
          {/* Cards */}
          {memories.map((memory, i) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.15, delay: i * 0.03 }}
            >
              <MemoryCard memory={memory} index={i} isStacked />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
