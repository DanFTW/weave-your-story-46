import { useState } from "react";
import { Thread, ThreadGradient } from "@/types/threads";
import { ThreadConfig } from "@/types/threadConfig";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Clock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreadDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: Thread | null;
  config: ThreadConfig | null;
  onGetStarted?: () => void;
}

const gradientClasses: Record<ThreadGradient, string> = {
  blue: "bg-gradient-to-br from-blue-500 to-blue-600",
  teal: "bg-gradient-to-br from-teal-500 to-teal-600",
  purple: "bg-gradient-to-br from-purple-500 to-purple-600",
  orange: "bg-gradient-to-br from-orange-500 to-orange-600",
  pink: "bg-gradient-to-br from-pink-500 to-rose-500",
};

const automationBenefits = [
  {
    icon: Zap,
    title: "Automatic",
    description: "Runs in the background without manual input",
  },
  {
    icon: Clock,
    title: "Real-time",
    description: "Captures information as it happens",
  },
  {
    icon: Shield,
    title: "Secure",
    description: "Your data stays private and encrypted",
  },
];

export function ThreadDetailSheet({
  open,
  onOpenChange,
  thread,
  config,
  onGetStarted,
}: ThreadDetailSheetProps) {
  if (!thread || !config) return null;

  const Icon = thread.icon;
  const isAutomation = thread.type === "automation";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl px-5 pb-safe max-h-[85vh] overflow-y-auto"
      >
        {/* Hero section with icon */}
        <div className="flex flex-col items-center pt-2 pb-4">
          <div className="w-12 h-1.5 bg-muted rounded-full mb-6" />
          
          <div
            className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-4",
              gradientClasses[thread.gradient]
            )}
          >
            <Icon className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          
          <SheetHeader className="text-center space-y-2">
            <SheetTitle className="text-2xl font-bold">{config.title}</SheetTitle>
            <SheetDescription className="text-base text-muted-foreground">
              {config.subtitle}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Description */}
        <div className="py-4 border-t border-border">
          <p className="text-foreground/80 text-center leading-relaxed">
            {config.description}
          </p>
        </div>

        {/* How it works */}
        <div className="py-4 border-t border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            How it works
          </h3>
          <div className="space-y-3">
            {config.steps.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center flex-shrink-0 shadow-sm">
                    {step.iconUrl ? (
                      <img src={step.iconUrl} alt="" className="w-5 h-5" />
                    ) : StepIcon ? (
                      <StepIcon className="w-4 h-4 text-foreground/70" />
                    ) : (
                      <span className="text-sm font-medium text-foreground/70">
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{step.title}</p>
                      {step.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {step.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Benefits for automations */}
        {isAutomation && (
          <div className="py-4 border-t border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Benefits
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {automationBenefits.map((benefit) => {
                const BenefitIcon = benefit.icon;
                return (
                  <div
                    key={benefit.title}
                    className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50"
                  >
                    <BenefitIcon className="w-5 h-5 text-primary mb-2" />
                    <p className="text-xs font-medium text-foreground">{benefit.title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="pt-4 pb-2">
          <Button
            onClick={onGetStarted}
            className={cn(
              "w-full h-14 text-lg font-semibold rounded-2xl text-white",
              gradientClasses[thread.gradient]
            )}
          >
            {thread.status === "setup" ? "Set up now" : "Get started"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
