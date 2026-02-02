import { cn } from "@/lib/utils";
import { FlowMode, TriggerType } from "@/types/threads";

interface ThreadTypeBadgeProps {
  flowMode?: FlowMode;
  triggerType?: TriggerType;
  variant: "flowMode" | "triggerType";
  className?: string;
}

export function ThreadTypeBadge({ flowMode, triggerType, variant, className }: ThreadTypeBadgeProps) {
  if (variant === "flowMode" && flowMode) {
    const colorClasses = {
      thread: "bg-blue-500/20 text-blue-100 border border-blue-400/30",
      flow: "bg-purple-500/20 text-purple-100 border border-purple-400/30",
      dump: "bg-teal-500/20 text-teal-100 border border-teal-400/30",
    };

    const labels = {
      thread: "Thread",
      flow: "Flow",
      dump: "Dump",
    };

    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
          colorClasses[flowMode],
          className
        )}
      >
        {labels[flowMode]}
      </span>
    );
  }

  if (variant === "triggerType" && triggerType) {
    const isAutomatic = triggerType === "automatic";
    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
          isAutomatic
            ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/30"
            : "bg-orange-500/20 text-orange-100 border border-orange-400/30",
          className
        )}
      >
        {isAutomatic ? "Auto" : "Manual"}
      </span>
    );
  }

  return null;
}
