import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Briefcase, 
  Utensils, 
  ShoppingBag, 
  Heart,
  NotebookPen,
  Coffee,
  SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MemoryFilterModal } from "./MemoryFilterModal";

interface MemoryFilterBarProps {
  activeFilter: string;
  statusFilter: string;
  onFilterChange: (filter: string) => void;
  onStatusFilterChange: (status: string) => void;
}

const filters = [
  { id: "all", label: "All", icon: null },
  { id: "quick_note", icon: NotebookPen, gradient: "bg-gradient-to-br from-indigo-500 to-blue-600" },
  { id: "family", icon: Users, gradient: "bg-gradient-to-br from-fuchsia-400 to-pink-500" },
  { id: "work", icon: Briefcase, gradient: "bg-gradient-to-br from-emerald-400 to-teal-500" },
  { id: "food", icon: Utensils, gradient: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { id: "shopping", icon: ShoppingBag, gradient: "bg-gradient-to-br from-cyan-400 to-blue-500" },
  { id: "personal", icon: Heart, gradient: "bg-gradient-to-br from-rose-400 to-red-500" },
  { id: "lifestyle", icon: Coffee, gradient: "bg-gradient-to-br from-violet-400 to-purple-500" },
];

export function MemoryFilterBar({ 
  activeFilter, 
  statusFilter,
  onFilterChange,
  onStatusFilterChange 
}: MemoryFilterBarProps) {
  const [showModal, setShowModal] = useState(false);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setShowLeftFade(scrollLeft > 0);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    handleScroll();
    const scrollEl = scrollRef.current;
    scrollEl?.addEventListener('scroll', handleScroll);
    return () => scrollEl?.removeEventListener('scroll', handleScroll);
  }, []);

  const handleApplyFilters = (filter: string, status: string) => {
    onFilterChange(filter);
    onStatusFilterChange(status);
  };

  const hasActiveFilters = activeFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex items-center gap-3">
      {/* Scrollable filter area with fades */}
      <div className="relative flex-1 min-w-0">
        {/* Left fade */}
        <div 
          className={cn(
            "absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showLeftFade ? "opacity-100" : "opacity-0"
          )}
        />
        
        {/* Scrollable container */}
        <div 
          ref={scrollRef}
          className="flex items-center gap-3 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;
            const Icon = filter.icon;
            
            return (
              <motion.button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200",
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
        
        {/* Right fade */}
        <div 
          className={cn(
            "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/* Filter button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setShowModal(true)}
        className={cn(
          "flex-shrink-0 h-11 w-11 rounded-xl border-border/50",
          hasActiveFilters && "border-primary bg-primary/5"
        )}
      >
        <SlidersHorizontal className={cn(
          "h-5 w-5",
          hasActiveFilters ? "text-primary" : "text-muted-foreground"
        )} />
      </Button>

      {/* Filter Modal */}
      <MemoryFilterModal
        open={showModal}
        onOpenChange={setShowModal}
        activeFilter={activeFilter}
        statusFilter={statusFilter}
        onApplyFilters={handleApplyFilters}
      />
    </div>
  );
}
