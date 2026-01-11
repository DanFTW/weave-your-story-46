import { motion } from "framer-motion";
import { 
  Users, 
  Briefcase, 
  Utensils, 
  ShoppingBag, 
  Heart,
  Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MemoryFilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: "all", label: "All", icon: null },
  { id: "family", icon: Users, gradient: "bg-gradient-to-br from-fuchsia-400 to-pink-500" },
  { id: "work", icon: Briefcase, gradient: "bg-gradient-to-br from-emerald-400 to-teal-500" },
  { id: "food", icon: Utensils, gradient: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { id: "shopping", icon: ShoppingBag, gradient: "bg-gradient-to-br from-cyan-400 to-blue-500" },
  { id: "personal", icon: Heart, gradient: "bg-gradient-to-br from-rose-400 to-red-500" },
];

export function MemoryFilterBar({ activeFilter, onFilterChange }: MemoryFilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      {filters.map((filter) => {
        const isActive = activeFilter === filter.id;
        const Icon = filter.icon;
        
        return (
          <motion.button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "relative flex items-center justify-center rounded-xl transition-all duration-200",
              filter.id === "all" 
                ? "h-11 px-6" 
                : "h-11 w-11",
              isActive && filter.id === "all"
                ? "bg-foreground text-primary-foreground"
                : filter.id === "all"
                ? "bg-secondary text-secondary-foreground"
                : "",
              filter.id !== "all" && filter.gradient
            )}
          >
            {filter.id === "all" ? (
              <span className="text-sm font-medium">{filter.label}</span>
            ) : Icon ? (
              <Icon className="h-5 w-5 text-white" />
            ) : null}
            
            {isActive && filter.id !== "all" && (
              <motion.div
                layoutId="activeFilter"
                className="absolute inset-0 rounded-xl ring-2 ring-foreground ring-offset-2 ring-offset-background"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
