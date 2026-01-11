import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Thread, ThreadGradient } from "@/types/threads";
import { StatusBadge } from "./StatusBadge";

interface ThreadCardProps {
  thread: Thread;
  onClick?: () => void;
  className?: string;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const Icon = thread.icon;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-6 text-left",
        "min-h-[160px] flex flex-col",
        "shadow-lg shadow-black/5",
        gradientClasses[thread.gradient],
        className
      )}
    >
      {/* Top row: Icon and Badge */}
      <div className="flex items-start justify-between w-full">
        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
        </div>
        <StatusBadge status={thread.status} />
      </div>

      {/* Spacer to push title to bottom */}
      <div className="flex-1 min-h-4" />

      {/* Title at bottom */}
      <h3 className="text-xl font-semibold text-white leading-tight">
        {thread.title}
      </h3>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    </motion.button>
  );
}
