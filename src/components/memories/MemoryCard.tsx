import { motion } from "framer-motion";
import { ArrowRight, Users, Briefcase, Utensils, ShoppingBag, Heart, NotebookPen, Coffee, Check, Loader2 } from "lucide-react";
import { Memory } from "@/types/memory";
import { cn } from "@/lib/utils";

interface MemoryCardProps {
  memory: Memory;
  index: number;
}

// Map categories to icons and gradients
const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string; label: string }> = {
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

function getCategoryConfig(category?: string, tag?: string) {
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

// Extract a title from memory content (first line or first N words)
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0];
  const words = firstLine.split(' ');
  if (words.length <= 6) return firstLine;
  return words.slice(0, 6).join(' ') + '...';
}

// Parse tags from various formats
function parseTags(memory: Memory): string[] {
  const tags: string[] = [];
  
  // Add tag if present
  if (memory.tag) {
    // Split by comma or space if multiple tags
    const tagParts = memory.tag.split(/[,\s]+/).filter(Boolean);
    tags.push(...tagParts);
  }
  
  // Add category as a tag too if different from tag
  if (memory.category && memory.category !== memory.tag) {
    tags.push(memory.category);
  }
  
  return tags.slice(0, 3); // Limit to 3 tags for display
}

export function MemoryCard({ memory, index }: MemoryCardProps) {
  const config = getCategoryConfig(memory.category, memory.tag);
  const Icon = config.icon;
  const title = extractTitle(memory.content);
  const description = memory.content.length > 100 
    ? memory.content.substring(0, 100) + '...' 
    : memory.content;
  const tags = parseTags(memory);
  const isSynced = true; // All loaded memories are synced

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
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug truncate">
              {title}
            </h3>
            <p className="text-xs text-white/80 font-medium">
              {config.label}
            </p>
          </div>
        </div>
      </div>
      
      {/* Content Body */}
      <div className="px-4 py-4">
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {description}
        </p>
        
        {/* Tags row */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
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
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              isSynced 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-amber-100 text-amber-700"
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
          </div>
          
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
