import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { 
  Users, 
  Briefcase, 
  Utensils, 
  ShoppingBag, 
  Heart,
  Sparkles,
  NotebookPen,
  Coffee
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface MemoryFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFilter: string;
  statusFilter: string;
  onApplyFilters: (filter: string, status: string) => void;
}

const threadFilters = [
  { id: "all", label: "All", icon: null },
  { id: "quick_note", icon: NotebookPen, gradient: "bg-gradient-to-br from-indigo-500 to-blue-600" },
  { id: "family", icon: Users, gradient: "bg-gradient-to-br from-fuchsia-400 to-pink-500" },
  { id: "work", icon: Briefcase, gradient: "bg-gradient-to-br from-emerald-400 to-teal-500" },
  { id: "food", icon: Utensils, gradient: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { id: "shopping", icon: ShoppingBag, gradient: "bg-gradient-to-br from-cyan-400 to-blue-500" },
  { id: "personal", icon: Heart, gradient: "bg-gradient-to-br from-rose-400 to-red-500" },
  { id: "lifestyle", icon: Coffee, gradient: "bg-gradient-to-br from-violet-400 to-purple-500" },
];

const statusOptions = [
  { id: "all", label: "All" },
  { id: "synced", label: "Synced", icon: Check },
  { id: "syncing", label: "Syncing", icon: Loader2 },
];

export function MemoryFilterModal({ 
  open, 
  onOpenChange, 
  activeFilter, 
  statusFilter,
  onApplyFilters 
}: MemoryFilterModalProps) {
  const [selectedThread, setSelectedThread] = useState(activeFilter);
  const [selectedStatus, setSelectedStatus] = useState(statusFilter);

  const handleReset = () => {
    setSelectedThread("all");
    setSelectedStatus("all");
  };

  const handleDone = () => {
    onApplyFilters(selectedThread, selectedStatus);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6 gap-6">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-xl font-semibold">Filter activity</DialogTitle>
        </DialogHeader>

        {/* Filter by thread */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">Filter by thread</p>
          <div className="flex flex-wrap gap-2">
            {threadFilters.map((filter) => {
              const isActive = selectedThread === filter.id;
              const Icon = filter.icon;
              
              return (
                <motion.button
                  key={filter.id}
                  onClick={() => setSelectedThread(filter.id)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative flex items-center justify-center rounded-xl transition-all duration-200",
                    filter.id === "all" 
                      ? "h-10 px-5" 
                      : "h-10 w-10",
                    isActive && filter.id === "all"
                      ? "bg-foreground text-primary-foreground"
                      : filter.id === "all"
                      ? "bg-secondary text-secondary-foreground"
                      : "",
                    filter.id !== "all" && filter.gradient,
                    isActive && filter.id !== "all" && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                  )}
                >
                  {filter.id === "all" ? (
                    <span className="text-sm font-medium">{filter.label}</span>
                  ) : Icon ? (
                    <Icon className="h-4 w-4 text-white" />
                  ) : null}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Filter by status */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-medium">Filter by status</p>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => {
              const isActive = selectedStatus === status.id;
              const Icon = status.icon;
              
              return (
                <motion.button
                  key={status.id}
                  onClick={() => setSelectedStatus(status.id)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                  )}
                >
                  {Icon && <Icon className={cn("h-4 w-4", status.id === "syncing" && "animate-spin")} />}
                  {isActive && status.id !== "all" && !Icon && <Check className="h-4 w-4" />}
                  {status.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1 rounded-xl"
          >
            Reset
          </Button>
          <Button
            onClick={handleDone}
            className="flex-1 rounded-xl"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
