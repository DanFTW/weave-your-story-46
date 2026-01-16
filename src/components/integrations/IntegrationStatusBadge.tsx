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
        className
      )}
    >
      {config.label}
    </span>
  );
}
