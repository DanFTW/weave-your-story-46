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
    const getStyles = () => {
      switch (flowMode) {
        case "thread":
          return "bg-blue-500/20 text-blue-100 border border-blue-400/30";
        case "flow":
          return "bg-purple-500/20 text-purple-100 border border-purple-400/30";
        case "dump":
          return "bg-teal-500/20 text-teal-100 border border-teal-400/30";
        default:
          return "bg-muted text-muted-foreground";
      }
    };

    const getLabel = () => {
      switch (flowMode) {
        case "thread":
          return "Thread";
        case "flow":
          return "Flow";
        case "dump":
          return "Dump";
        default:
          return flowMode;
      }
    };

    return (
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
          getStyles(),
          className
        )}
      >
        {getLabel()}
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
