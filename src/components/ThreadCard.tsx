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

export function ThreadCard({ thread, onClick, className }: ThreadCardProps) {
  const Icon = thread.icon;
  const hasIntegrations = thread.integrations && thread.integrations.length > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        "min-h-[140px] flex flex-col",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        gradientClasses[thread.gradient],
        className
      )}
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
          <div className="flex items-center gap-1.5">
            {thread.integrations!.map((integration) => (
              <div
                key={integration}
                className="w-6 h-6 rounded-md bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden"
              >
                <IntegrationIcon icon={integration} className="w-4 h-4" />
              </div>
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
