import { ChevronRight, Sparkles, Users } from "lucide-react";
import { ThreadStep, StepType } from "@/types/threadConfig";
import { cn } from "@/lib/utils";

interface ThreadStepCardProps {
  step: ThreadStep;
  onClick?: () => void;
}

const defaultIcons: Record<StepType, React.ReactNode> = {
  setup: <Sparkles className="w-5 h-5 text-muted-foreground" />,
  integration: null,
  save: null,
};

export function ThreadStepCard({ step, onClick }: ThreadStepCardProps) {
  const Icon = step.icon;
  const isSimple = step.type === "setup" && !step.iconUrl;

  if (isSimple) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left bg-secondary/50 rounded-2xl px-5 py-4",
          "active:scale-[0.99] transition-transform"
        )}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            {Icon ? <Icon className="w-5 h-5 text-muted-foreground" /> : defaultIcons[step.type]}
          </div>
          <span className="font-semibold text-foreground">{step.title}</span>
          <ChevronRight className="w-5 h-5 text-muted-foreground/50 ml-auto flex-shrink-0" />
        </div>
        {step.description && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground pl-1">
            <Users className="w-4 h-4" />
            <span>{step.description}</span>
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full bg-card rounded-2xl px-4 py-4 flex items-center gap-4",
        "shadow-sm border border-border/50",
        "active:scale-[0.99] transition-transform"
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {step.iconUrl ? (
          <img src={step.iconUrl} alt={step.title} className="w-7 h-7 object-contain" />
        ) : Icon ? (
          <Icon className="w-6 h-6 text-muted-foreground" />
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{step.title}</span>
          {step.badge && (
            <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded whitespace-nowrap">
              {step.badge}
            </span>
          )}
        </div>
        {step.description && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {step.description}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />
    </button>
  );
}
