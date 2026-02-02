import { cn } from "@/lib/utils";
import { Thread, ThreadGradient } from "@/types/threads";
import { IntegrationIcon } from "./integrations/IntegrationIcon";
import { ThreadTypeBadge } from "./threads/ThreadTypeBadge";
import { ChevronRight } from "lucide-react";

interface ThreadCardProps {
  thread: Thread;
  onClick?: () => void;
  className?: string;
  fixedHeight?: boolean;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

// Integration complementary color gradients
// Based on color wheel theory - complementary colors to brand colors
const integrationGradients: Record<string, string> = {
  twitter: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
  instagram: "linear-gradient(135deg, #1ECF93 0%, #15A676 100%)",
  gmail: "linear-gradient(135deg, #16BC9A 0%, #0F9A7D 100%)",
  youtube: "linear-gradient(135deg, #00D4D4 0%, #00A3A3 100%)",
  linkedin: "linear-gradient(135deg, #F5993D 0%, #D97B1F 100%)",
  hubspot: "linear-gradient(135deg, #0085A6 0%, #006680 100%)",
  trello: "linear-gradient(135deg, #CCAD00 0%, #A68C00 100%)",
  googlephotos: "linear-gradient(135deg, #BC7A0B 0%, #956208 100%)",
};

// Filler icons that represent device capabilities, not external services
const fillerIntegrations = ["camera", "location"];

export function ThreadCard({ thread, onClick, className, fixedHeight = false }: ThreadCardProps) {
  // Filter out filler integrations (device capabilities, not services)
  const serviceIntegrations = thread.integrations?.filter(
    (integration) => !fillerIntegrations.includes(integration)
  );
  const hasIntegrations = serviceIntegrations && serviceIntegrations.length > 0;
  
  // Get the primary integration for dynamic gradient
  const primaryIntegration = serviceIntegrations?.[0];
  const dynamicGradient = primaryIntegration 
    ? integrationGradients[primaryIntegration] 
    : undefined;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        fixedHeight ? "h-[140px]" : "min-h-[140px]",
        "flex flex-col",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        !dynamicGradient && gradientClasses[thread.gradient],
        className
      )}
      style={dynamicGradient ? { background: dynamicGradient } : undefined}
    >
      {/* Top Row: Title + Arrow */}
      <div className="flex items-start gap-3">
        {/* Title and Description - takes full width */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white leading-tight truncate">
            {thread.title}
          </h3>
          {thread.description && (
            <p className="mt-1 text-sm text-white/70 line-clamp-2">
              {thread.description}
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
          <ChevronRight className="w-4 h-4 text-white/80" />
        </div>
      </div>

      {/* Bottom Row: Integrations + Badges */}
      <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
        {/* Integration Icons (filtered) */}
        {hasIntegrations && (
          <div className="flex items-center gap-2">
            {serviceIntegrations!.map((integration) => (
              <IntegrationIcon
                key={integration}
                icon={integration}
                className="w-7 h-7"
              />
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Badges - Auto/Manual + Flow Mode */}
        <div className="flex items-center gap-1.5">
          <ThreadTypeBadge variant="triggerType" triggerType={thread.triggerType} />
          <ThreadTypeBadge variant="flowMode" flowMode={thread.flowMode} />
        </div>
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    </button>
  );
}
