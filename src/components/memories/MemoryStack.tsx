import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, ArrowRight } from "lucide-react";
import { Memory } from "@/types/memory";
import { MemoryCard, getCategoryConfig } from "./MemoryCard";
import { cn } from "@/lib/utils";

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
  
  // Show first memory's content preview
  const previewMemory = memories[0];
  const previewContent = previewMemory.content.length > 80 
    ? previewMemory.content.substring(0, 80) + '...' 
    : previewMemory.content;

  if (count === 1) {
    return <MemoryCard memory={memories[0]} index={index} />;
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative cursor-pointer"
            onClick={() => setIsExpanded(true)}
          >
            {/* Stacked cards behind (visual only) */}
            {count >= 3 && (
              <div 
                className="absolute left-2 right-2 top-3 h-full rounded-2xl bg-card/60 border border-border/20"
                style={{ zIndex: 1 }}
              />
            )}
            {count >= 2 && (
              <div 
                className="absolute left-1 right-1 top-1.5 h-full rounded-2xl bg-card/80 border border-border/25"
                style={{ zIndex: 2 }}
              />
            )}
            
            {/* Main card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className="relative rounded-2xl bg-card overflow-hidden border border-border/30 shadow-sm"
              style={{ zIndex: 3 }}
            >
              {/* Header */}
              <div className={cn("px-4 py-3", config.gradient)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {config.label}
                    </span>
                  </div>
                  {/* Count badge */}
                  <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm px-2">
                    <span className="text-xs font-bold text-white">{count}</span>
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="px-4 py-3.5">
                <p className="text-sm text-foreground leading-relaxed mb-3">
                  {previewContent}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Synced
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Tap to expand
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Collapse button */}
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setIsExpanded(false)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
              <span>Collapse {count} {config.label}s</span>
            </motion.button>
            
            {/* Expanded cards */}
            {memories.map((memory, i) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <MemoryCard memory={memory} index={i} isStacked />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
