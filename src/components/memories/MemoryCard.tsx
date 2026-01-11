import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Utensils, ShoppingBag, Heart, Sparkles } from "lucide-react";
import { Memory } from "@/types/memory";
import { cn } from "@/lib/utils";

interface MemoryCardProps {
  memory: Memory;
  index: number;
}

// Map tags to icons and gradients
const tagConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string }> = {
  family: { icon: Users, gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500" },
  work: { icon: Briefcase, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500" },
  food: { icon: Utensils, gradient: "bg-gradient-to-r from-amber-400 to-orange-500" },
  shopping: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-cyan-400 to-blue-500" },
  personal: { icon: Heart, gradient: "bg-gradient-to-r from-rose-400 to-red-500" },
  default: { icon: Sparkles, gradient: "bg-gradient-to-r from-blue-400 to-indigo-500" },
};

function getTagConfig(tag?: string) {
  if (!tag) return tagConfig.default;
  const lowerTag = tag.toLowerCase();
  return tagConfig[lowerTag] || tagConfig.default;
}

// Extract a title from memory content (first line or first N words)
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0];
  const words = firstLine.split(' ');
  if (words.length <= 6) return firstLine;
  return words.slice(0, 6).join(' ') + '...';
}

export function MemoryCard({ memory, index }: MemoryCardProps) {
  const config = getTagConfig(memory.tag);
  const Icon = config.icon;
  const title = extractTitle(memory.content);
  const description = memory.content.length > 100 
    ? memory.content.substring(0, 100) + '...' 
    : memory.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-2xl bg-card overflow-hidden border border-border/30 shadow-sm"
    >
      {/* Gradient Header with Icon and Title */}
      <div className={cn("px-4 py-3", config.gradient)}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">
            {title}
          </h3>
        </div>
      </div>
      
      {/* Content Body */}
      <div className="px-4 py-4">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {description}
        </p>
        
        {/* Footer with Tags and Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {memory.tag && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Completed
              </span>
            )}
          </div>
          
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
