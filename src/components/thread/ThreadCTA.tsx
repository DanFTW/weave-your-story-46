import { cn } from "@/lib/utils";
import { ThreadGradient } from "@/types/threads";

interface ThreadCTAProps {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  gradient?: ThreadGradient;
}

const gradientButtonClasses: Record<ThreadGradient, string> = {
  blue: "bg-[hsl(var(--thread-blue-from))] shadow-blue-500/25",
  teal: "bg-[hsl(var(--thread-teal-from))] shadow-teal-500/25",
  purple: "bg-[hsl(var(--thread-purple-from))] shadow-purple-500/25",
  orange: "bg-[hsl(var(--thread-orange-from))] shadow-orange-500/25",
  pink: "bg-[hsl(var(--thread-pink-from))] shadow-pink-500/25",
};

export function ThreadCTA({ label = "Get started", onClick, disabled, gradient = "orange" }: ThreadCTAProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Progressive blur fade */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none" />
      <div className="absolute inset-0 backdrop-blur-sm [mask-image:linear-gradient(to_top,black_60%,transparent)]" />
      
      {/* Button container */}
      <div className="relative px-5 pb-safe pt-4 safe-bottom">
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "w-full h-14 rounded-2xl font-semibold text-base",
            "text-white shadow-lg",
            "active:scale-[0.98] transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            gradientButtonClasses[gradient]
          )}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
