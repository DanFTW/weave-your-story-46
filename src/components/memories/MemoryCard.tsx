import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase, Utensils, ShoppingBag, Heart, NotebookPen, Coffee, Check, Loader2 } from "lucide-react";
import { Memory } from "@/types/memory";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface MemoryCardProps {
  memory: Memory;
  index: number;
  isStacked?: boolean;
}

// Map categories to icons and gradients
export const categoryConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string; label: string }> = {
  quick_note: { icon: NotebookPen, gradient: "bg-gradient-to-r from-indigo-500 to-blue-600", label: "Quick Note" },
  default: { icon: NotebookPen, gradient: "bg-gradient-to-r from-indigo-500 to-blue-600", label: "Quick Note" },
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
  receipts: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-teal-400 to-cyan-500", label: "Receipt" },
  receipt: { icon: ShoppingBag, gradient: "bg-gradient-to-r from-teal-400 to-cyan-500", label: "Receipt" },
};

export function getCategoryConfig(category?: string, tag?: string) {
  // Normalize and check category first
  if (category) {
    const lowerCategory = category.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerCategory]) return categoryConfig[lowerCategory];
  }
  // Then check tag
  if (tag) {
    const lowerTag = tag.toLowerCase().replace(/\s+/g, '_');
    if (categoryConfig[lowerTag]) return categoryConfig[lowerTag];
  }
  // Check if category or tag contains known keywords
  const combined = `${category || ''} ${tag || ''}`.toLowerCase();
  if (combined.includes('family')) return categoryConfig.family;
  if (combined.includes('work')) return categoryConfig.work;
  if (combined.includes('food')) return categoryConfig.food;
  if (combined.includes('shopping')) return categoryConfig.shopping;
  if (combined.includes('personal')) return categoryConfig.personal;
  
  return categoryConfig.default;
}

function parseTags(memory: Memory): string[] {
  const tags: string[] = [];
  if (memory.tag) {
    const tagParts = memory.tag.split(/[,\s]+/).filter(Boolean);
    tags.push(...tagParts);
  }
  return tags.slice(0, 3);
}

export function MemoryCard({ memory, index, isStacked = false }: MemoryCardProps) {
  const navigate = useNavigate();
  const config = getCategoryConfig(memory.category, memory.tag);
  const Icon = config.icon;
  const description = memory.content;
  const tags = parseTags(memory);
  const isSynced = true;

  const timestamp = (() => {
    try {
      return format(parseISO(memory.createdAt), "h:mm a");
    } catch {
      return "";
    }
  })();

  const handleClick = () => {
    navigate(`/memory/${memory.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: isStacked ? 0 : index * 0.02 }}
      onClick={handleClick}
      className="rounded-2xl bg-card overflow-hidden border border-border/30 shadow-sm cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
    >
      {/* Compact Header */}
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
          <span className="text-xs text-white/70">{timestamp}</span>
        </div>
      </div>
      
      {/* Content Body */}
      <div className="px-3 py-3">
        <p className="text-sm text-foreground leading-relaxed mb-2.5">
          {description}
        </p>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {tags.map((tag, i) => (
              <span 
                key={i}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Footer */}
        <div className="flex items-center justify-start">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            isSynced 
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          )}>
            {isSynced ? (
              <>
                <Check className="h-2.5 w-2.5" />
                Synced
              </>
            ) : (
              <>
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Syncing
              </>
            )}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
