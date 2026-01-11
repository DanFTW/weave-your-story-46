import { cn } from "@/lib/utils";
import { ThreadStatus } from "@/types/threads";

interface StatusBadgeProps {
  status: ThreadStatus;
  className?: string;
}

const statusConfig: Record<ThreadStatus, { label: string; variant: "filled" | "outline" }> = {
  setup: { label: "Setup", variant: "filled" },
  active: { label: "View", variant: "outline" },
  try: { label: "Try it", variant: "outline" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-full transition-all",
        config.variant === "filled"
          ? "bg-foreground text-background"
          : "bg-white/25 text-white backdrop-blur-sm",
        className
      )}
    >
      {config.label}
    </span>
  );
}
