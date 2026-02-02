import { cn } from "@/lib/utils";
import { Thread, ThreadGradient } from "@/types/threads";
import { IntegrationIcon } from "./integrations/IntegrationIcon";
import { ThreadTypeBadge } from "./threads/ThreadTypeBadge";
import { ChevronRight } from "lucide-react";

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

// Integration to complementary gradient mapping (based on color theory - 180° on color wheel)
const integrationGradients: Record<string, string> = {
  hubspot: "linear-gradient(135deg, #0085A6 0%, #006680 100%)",      // Teal-Blue (complement of orange)
  trello: "linear-gradient(135deg, #CCAD00 0%, #A68C00 100%)",       // Gold/Orange (complement of blue)
  linkedin: "linear-gradient(135deg, #F5993D 0%, #D97B1F 100%)",     // Orange (complement of blue)
  twitter: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",      // Blue (fallback for dark icons)
  instagram: "linear-gradient(135deg, #1ECF93 0%, #15A676 100%)",    // Mint (complement of pink)
  gmail: "linear-gradient(135deg, #16BC9A 0%, #0F9A7D 100%)",        // Teal (complement of red)
  youtube: "linear-gradient(135deg, #00D4D4 0%, #00A3A3 100%)",      // Cyan (complement of red)
  googlephotos: "linear-gradient(135deg, #BC7A0B 0%, #956208 100%)", // Amber (complement of blue)
  camera: "linear-gradient(135deg, #00D4AA 0%, #00A688 100%)",       // Teal
  spotify: "linear-gradient(135deg, #FF69B4 0%, #E54D9A 100%)",      // Pink (complement of green)
  discord: "linear-gradient(135deg, #FFB347 0%, #E69A2E 100%)",      // Orange (complement of purple)
  whatsapp: "linear-gradient(135deg, #FF6B6B 0%, #E54D4D 100%)",     // Coral (complement of green)
  github: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",       // Blue (fallback for dark icons)
  notion: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",       // Blue (fallback for dark icons)
  perplexity: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",   // Blue (fallback for dark icons)
  zoom: "linear-gradient(135deg, #FF5A5F 0%, #E54347 100%)",         // Coral (complement of blue)
  slack: "linear-gradient(135deg, #FF69B4 0%, #E54D9A 100%)",        // Pink
  figma: "linear-gradient(135deg, #00CED1 0%, #00A8AB 100%)",        // Dark Cyan
  reddit: "linear-gradient(135deg, #00BFFF 0%, #0099CC 100%)",       // Deep Sky Blue (complement of orange)
  facebook: "linear-gradient(135deg, #FFD700 0%, #CCAC00 100%)",     // Gold (complement of blue)
};

export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const Icon = thread.icon;
  const hasIntegrations = thread.integrations && thread.integrations.length > 0;
  
  // Get dynamic gradient from primary integration, or fall back to static gradient
  const primaryIntegration = thread.integrations?.[0];
  const dynamicGradient = primaryIntegration ? integrationGradients[primaryIntegration] : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        "min-h-[140px] flex flex-col",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        !dynamicGradient && gradientClasses[thread.gradient],
        className
      )}
      style={dynamicGradient ? { background: dynamicGradient } : undefined}
    >
      {/* Top Row: Icon, Title, Arrow */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
          <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>

        {/* Title and Description */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white leading-tight">
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
        {/* Integration Icons */}
        {hasIntegrations && (
          <div className="flex items-center gap-2">
            {thread.integrations!.map((integration) => (
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

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          <ThreadTypeBadge variant="flowMode" flowMode={thread.flowMode} />
          <ThreadTypeBadge variant="triggerType" triggerType={thread.triggerType} />
        </div>
      </div>

      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
    </button>
  );
}
