import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Thread, ThreadGradient } from "@/types/threads";
import { IntegrationIcon } from "./integrations/IntegrationIcon";
import { ThreadTypeBadge } from "./threads/ThreadTypeBadge";

interface ThreadCardProps {
  thread: Thread;
  onClick?: () => void;
  className?: string;
}

// Orb + background color config per integration or gradient fallback
interface CardColorConfig {
  cardBg: string;
  orbBg: string;
  orbGradientFrom: string;
  orbGradientTo: string;
}

const integrationColors: Record<string, CardColorConfig> = {
  twitter:      { cardBg: "#3B82F6", orbBg: "#2EAFFF", orbGradientFrom: "#3CC8FF", orbGradientTo: "#D3F3FF" },
  instagram:    { cardBg: "#1ECF93", orbBg: "#5EEDB8", orbGradientFrom: "#7AFFD0", orbGradientTo: "#D0FFF0" },
  gmail:        { cardBg: "#16BC9A", orbBg: "#3DE0BB", orbGradientFrom: "#5AEAC8", orbGradientTo: "#C8FFF0" },
  youtube:      { cardBg: "#00D4D4", orbBg: "#40E8E8", orbGradientFrom: "#6AF0F0", orbGradientTo: "#D0FCFC" },
  linkedin:     { cardBg: "#F5993D", orbBg: "#FFBE6B", orbGradientFrom: "#FFD08A", orbGradientTo: "#FFE8C4" },
  hubspot:      { cardBg: "#0085A6", orbBg: "#2EB8D8", orbGradientFrom: "#50CCE5", orbGradientTo: "#C4F0FA" },
  trello:       { cardBg: "#CCAD00", orbBg: "#E8D040", orbGradientFrom: "#F0DC60", orbGradientTo: "#FFF8C4" },
  googlephotos: { cardBg: "#BC7A0B", orbBg: "#E0A030", orbGradientFrom: "#F0B850", orbGradientTo: "#FFE8B0" },
  fireflies:    { cardBg: "#6C3AED", orbBg: "#9B6FE0", orbGradientFrom: "#A87FE8", orbGradientTo: "#D4C0F9" },
  discord:      { cardBg: "#99AAF5", orbBg: "#B0C0FF", orbGradientFrom: "#C4D0FF", orbGradientTo: "#E8ECFF" },
  googledrive:  { cardBg: "#437CFB", orbBg: "#2EAFFF", orbGradientFrom: "#3CC8FF", orbGradientTo: "#D3F3FF" },
  todoist:      { cardBg: "#E87A3D", orbBg: "#F5A040", orbGradientFrom: "#FFBE6B", orbGradientTo: "#FFE0B2" },
  spotify:      { cardBg: "#1DB954", orbBg: "#1ED760", orbGradientFrom: "#4AE87A", orbGradientTo: "#C8F7D8" },
};

const gradientFallbackColors: Record<ThreadGradient, CardColorConfig> = {
  blue:   { cardBg: "#437CFB", orbBg: "#2EAFFF", orbGradientFrom: "#3CC8FF", orbGradientTo: "#D3F3FF" },
  teal:   { cardBg: "#2A8B7A", orbBg: "#3DAA96", orbGradientFrom: "#50C0AC", orbGradientTo: "#C0F0E4" },
  purple: { cardBg: "#7B4FC7", orbBg: "#9B6FE0", orbGradientFrom: "#A87FE8", orbGradientTo: "#D4C0F9" },
  orange: { cardBg: "#E87A3D", orbBg: "#F5A040", orbGradientFrom: "#FFBE6B", orbGradientTo: "#FFE0B2" },
  pink:   { cardBg: "#D94FA0", orbBg: "#E87AB8", orbGradientFrom: "#F098CC", orbGradientTo: "#FFD4E8" },
};

// Filler icons that represent device capabilities, not external services
const fillerIntegrations = ["camera", "location"];

function getColorConfig(thread: Thread): CardColorConfig {
  const serviceIntegrations = thread.integrations?.filter(
    (i) => !fillerIntegrations.includes(i)
  );
  // Multi-provider threads use neutral gradient fallback
  if (serviceIntegrations && serviceIntegrations.length > 1) {
    return gradientFallbackColors[thread.gradient];
  }
  const primary = serviceIntegrations?.[0];
  if (primary && integrationColors[primary]) {
    return integrationColors[primary];
  }
  return gradientFallbackColors[thread.gradient];
}

function isMultiProvider(thread: Thread): boolean {
  const serviceIntegrations = thread.integrations?.filter(
    (i) => !fillerIntegrations.includes(i)
  );
  return (serviceIntegrations?.length ?? 0) > 1;
}

export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const colors = getColorConfig(thread);

  const multiProvider = isMultiProvider(thread);

  // Get the primary service integration for the icon (single-provider only)
  const serviceIntegrations = thread.integrations?.filter(
    (i) => !fillerIntegrations.includes(i)
  );
  const primaryIcon = multiProvider ? undefined : serviceIntegrations?.[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden h-[170px]",
        "flex flex-col",
        "active:scale-[0.98] transition-transform",
        className
      )}
      style={{
        background: colors.cardBg,
        borderRadius: 36,
        boxShadow: "-10px 0px 16px rgba(0, 0, 0, 0.04)",
        paddingTop: 20,
        paddingBottom: 24,
        paddingLeft: 20,
        paddingRight: 12,
      }}
    >
      {/* Decorative gradient orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 337.5,
          height: 337.5,
          padding: 60,
          transform: "rotate(-39deg)",
          transformOrigin: "top left",
          background: colors.orbBg,
          borderRadius: 300,
          filter: "blur(50px)",
          top: -60,
          right: -80,
        }}
      >
        <div
          style={{
            width: 305.64,
            height: 305.64,
            background: `linear-gradient(180deg, ${colors.orbGradientFrom} 0%, ${colors.orbGradientTo} 100%)`,
            borderRadius: 300,
          }}
        />
      </div>

      {/* Content layer */}
      <div className="relative z-10 flex flex-col justify-between h-full w-full">
        {/* Top row: icon + badges */}
        <div className="flex items-start justify-between">
          {/* Integration icon */}
          <div className="w-12 h-12 flex items-center justify-center">
            {primaryIcon ? (
              <IntegrationIcon icon={primaryIcon} className="w-12 h-12" />
            ) : (
              <thread.icon className="w-10 h-10 text-white/90" />
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5">
            <ThreadTypeBadge variant="triggerType" triggerType={thread.triggerType} />
            <ThreadTypeBadge variant="flowMode" flowMode={thread.flowMode} />
          </div>
        </div>

        {/* Bottom row: title + "Try it" button */}
        <div className="flex items-end justify-between gap-3">
          <h3
            className="text-white text-left flex-1 min-w-0 line-clamp-2"
            style={{
              fontSize: 22,
              lineHeight: "26px",
              fontFamily: "PP Telegraf",
              fontWeight: 700,
            }}
          >
            {thread.title}
          </h3>

          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
            <ChevronRight className="w-6 h-6 text-white/90" />
          </div>
        </div>
      </div>
    </button>
  );
}
