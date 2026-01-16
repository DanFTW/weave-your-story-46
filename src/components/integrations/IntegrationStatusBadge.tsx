import { cn } from "@/lib/utils";
import { IntegrationStatus } from "@/types/integrations";

interface IntegrationStatusBadgeProps {
  status: IntegrationStatus;
  className?: string;
}

const statusConfig: Record<IntegrationStatus, { label: string; visible: boolean }> = {
  connected: { label: "Connected", visible: true },
  unconfigured: { label: "Unconfigured", visible: true },
  approved: { label: "", visible: false },
  none: { label: "", visible: false },
  "coming-soon": { label: "Coming soon", visible: true },
};

export function IntegrationStatusBadge({ status, className }: IntegrationStatusBadgeProps) {
  const config = statusConfig[status];

  if (!config.visible) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full",
        status === "connected" && "bg-emerald-500 text-white",
        status === "unconfigured" && "bg-muted text-muted-foreground",
        status === "coming-soon" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        className
      )}
    >
      {config.label}
    </span>
  );
}
