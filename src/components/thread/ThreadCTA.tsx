import { cn } from "@/lib/utils";

interface ThreadCTAProps {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function ThreadCTA({ label = "Get started", onClick, disabled }: ThreadCTAProps) {
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
            "bg-[hsl(var(--thread-orange-from))] text-white",
            "shadow-lg shadow-orange-500/25",
            "active:scale-[0.98] transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
