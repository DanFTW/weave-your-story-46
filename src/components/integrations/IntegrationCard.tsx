import { cn } from "@/lib/utils";
import { Integration } from "@/types/integrations";
import { IntegrationIcon } from "./IntegrationIcon";
import { IntegrationStatusBadge } from "./IntegrationStatusBadge";
import { ChevronRight } from "lucide-react";

interface IntegrationCardProps {
  integration: Integration;
  onClick?: () => void;
  className?: string;
}

export function IntegrationCard({ integration, onClick, className }: IntegrationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 bg-card rounded-2xl",
        "active:scale-[0.98] transition-transform",
        className
      )}
    >
      {/* Icon */}
      <IntegrationIcon icon={integration.icon} />

      {/* Content */}
      <div className="flex-1 text-left min-w-0">
        <h3 className="text-base font-medium text-foreground">
          {integration.name}
        </h3>
        {integration.subtitle && (
          <p className="text-sm text-emerald-500 font-medium">
            {integration.subtitle}
          </p>
        )}
      </div>

      {/* Status Badge */}
      <IntegrationStatusBadge status={integration.status} />

      {/* Chevron */}
      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
