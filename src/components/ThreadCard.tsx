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
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        "h-32 flex items-center gap-4",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        gradientClasses[thread.gradient],
        className
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
        <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-white leading-tight flex-1">
        {thread.title}
      </h3>

      {/* Badge */}
      <StatusBadge status={thread.status} />

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    </button>
  );
}
