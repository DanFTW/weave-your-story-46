import { motion } from "framer-motion";
import { Home, Workflow, TrendingUp, Layers, User } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = "home" | "threads" | "insights" | "memories" | "profile";

interface BottomNavProps {
  activeItem: NavItem;
  onItemClick: (item: NavItem) => void;
}

const navItems: { id: NavItem; icon: typeof Home; label: string }[] = [
  { id: "home", icon: Home, label: "Home" },
  { id: "threads", icon: Workflow, label: "Threads" },
  { id: "insights", icon: TrendingUp, label: "Insights" },
  { id: "memories", icon: Layers, label: "Memories" },
  { id: "profile", icon: User, label: "Profile" },
];

export function BottomNav({ activeItem, onItemClick }: BottomNavProps) {
  return (
    <nav className="fixed bottom-6 left-4 right-4 z-50">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
        className="bg-card rounded-full px-2 py-2 shadow-xl shadow-black/10 border border-border/50 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "relative flex items-center justify-center w-12 h-12 rounded-full transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  "relative z-10 w-5 h-5 transition-all",
                  isActive && "stroke-[2.5]"
                )}
              />
            </motion.button>
          );
        })}
      </motion.div>
    </nav>
  );
}
