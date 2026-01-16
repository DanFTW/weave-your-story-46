import { HelpCircle } from "lucide-react";
import { ThreadStep } from "@/types/threadConfig";
import { cn } from "@/lib/utils";

interface ThreadStepCardProps {
  step: ThreadStep;
  stepNumber: number;
  isLast?: boolean;
  onClick?: () => void;
}

export function ThreadStepCard({ step, stepNumber, isLast = false, onClick }: ThreadStepCardProps) {
  const Icon = step.icon;

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        {/* Step number circle */}
        <div className="w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0 z-10">
          <span className="text-sm font-semibold text-primary">{stepNumber}</span>
        </div>
        {/* Connecting line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-2" />
        )}
      </div>

      {/* Content */}
      <div 
        onClick={onClick}
        className={cn(
          "flex-1 pb-6 cursor-pointer group",
          isLast && "pb-0"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          {(step.iconUrl || Icon) && (
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
              {step.iconUrl ? (
                <img src={step.iconUrl} alt={step.title} className="w-5 h-5 object-contain" />
              ) : Icon ? (
                <Icon className="w-5 h-5 text-muted-foreground" />
              ) : null}
            </div>
          )}

          {/* Text content */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{step.title}</span>
              {step.badge && (
                <span className="text-[9px] font-semibold text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                  {step.badge}
                </span>
              )}
            </div>
            {step.description && (
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {step.description}
              </p>
            )}
          </div>

          {/* Help icon */}
          <HelpCircle className="w-5 h-5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </div>
    </div>
  );
}