import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Utensils, ShoppingBag, Heart, NotebookPen, Coffee, Check, Loader2 } from "lucide-react";
import { Memory } from "@/types/memory";
import { cn } from "@/lib/utils";

interface MemoryCardProps {
  memory: Memory;
  index: number;
  isStacked?: boolean;
  stackPosition?: number;
}

// Map categories to icons and gradients
export const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string; label: string }> = {
  quick_note: { icon: NotebookPen, gradient: "bg-gradient-to-r from-indigo-500 to-blue-600", label: "Quick Note" },
  family: { icon: Users, gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500", label: "Family Memory" },
  family_memory: { icon: Users, gradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500", label: "Family Memory" },
  work: { icon: Briefcase, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500", label: "Work Memory" },
  work_memory: { icon: Briefcase, gradient: "bg-gradient-to-r from-emerald-400 to-teal-500", label: "Work Memory" },
  food: { icon: Utensils, gradient: "bg-gradient-to-r from-amber-400 to-orange-500", label: "Food Memory" },
  food_memory: { icon: Utensils, gradient: "bg-gradient-to-r from-amber-400 to-orange-500", label: "Food Memory" },
  shopping: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-cyan-400 to-blue-500", label: "Shopping Memory" },
  shopping_memory: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-cyan-400 to-blue-500", label: "Shopping Memory" },
  personal: { icon: Heart, gradient: "bg-gradient-to-r from-rose-400 to-red-500", label: "Personal Memory" },
  personal_memory: { icon: Heart, gradient: "bg-gradient-to-r from-rose-400 to-red-500", label: "Personal Memory" },
  lifestyle: { icon: Coffee, gradient: "bg-gradient-to-r from-violet-400 to-purple-500", label: "Lifestyle Memory" },
  default: { icon: NotebookPen, gradient: "bg-gradient-to-r from-blue-400 to-indigo-500", label: "Memory" },
};

export function getCategoryConfig(category?: string, tag?: string) {
  if (category) {
    const lowerCategory = category.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerCategory]) return categoryConfig[lowerCategory];
  }
  if (tag) {
    const lowerTag = tag.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerTag]) return categoryConfig[lowerTag];
  }
  return categoryConfig.default;
}

// Parse tags from various formats
function parseTags(memory: Memory): string[] {
  const tags: string[] = [];
  
  if (memory.tag) {
    const tagParts = memory.tag.split(/[,\s]+/).filter(Boolean);
    tags.push(...tagParts);
  }
  
  return tags.slice(0, 3);
}

export function MemoryCard({ memory, index, isStacked = false, stackPosition = 0 }: MemoryCardProps) {
  const config = getCategoryConfig(memory.category, memory.tag);
  const Icon = config.icon;
  const description = memory.content.length > 120 
    ? memory.content.substring(0, 120) + '...' 
    : memory.content;
  const tags = parseTags(memory);
  const isSynced = true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={cn(
        "rounded-2xl bg-card overflow-hidden border border-border/30",
        isStacked ? "shadow-sm" : "shadow-sm"
      )}
    >
      {/* Compact Header with Category Icon and Label */}
      <div className={cn("px-4 py-3", config.gradient)}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">
            {config.label}
          </span>
        </div>
      </div>
      
      {/* Content Body */}
      <div className="px-4 py-3.5">
        <p className="text-sm text-foreground leading-relaxed mb-3">
          {description}
        </p>
        
        {/* Tags row */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag, i) => (
              <span 
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Footer with Sync Status and Action */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            isSynced 
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          )}>
            {isSynced ? (
              <>
                <Check className="h-3 w-3" />
                Synced
              </>
            ) : (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing
              </>
            )}
          </span>
          
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
