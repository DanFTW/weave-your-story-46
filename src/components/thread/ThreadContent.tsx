import { ThreadStep } from "@/types/threadConfig";
import { ThreadStepCard } from "./ThreadStepCard";

interface ThreadContentProps {
  subtitle: string;
  description: string;
  steps: ThreadStep[];
  onStepClick?: (stepId: string) => void;
}

export function ThreadContent({ subtitle, description, steps, onStepClick }: ThreadContentProps) {
  return (
    <div className="relative -mt-4 rounded-t-[2rem] bg-background px-5 pt-7 pb-32 min-h-[50vh]">
      {/* Header */}
      <h2 className="text-xl font-bold text-foreground mb-2">
        {subtitle}
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed mb-6">
        {description}
      </p>

      {/* Workflow Steps */}
      <div className="pl-1">
        {steps.map((step, index) => (
          <ThreadStepCard
            key={step.id}
            step={step}
            stepNumber={index + 1}
            isLast={index === steps.length - 1}
            onClick={() => onStepClick?.(step.id)}
          />
        ))}
      </div>
    </div>
  );
}
