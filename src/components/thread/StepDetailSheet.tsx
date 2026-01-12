import { ThreadStep } from "@/types/threadConfig";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Info, Sparkles, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ThreadStep | null;
}

// Extended details for each step type
const stepTypeDetails: Record<string, { 
  benefits: { icon: typeof Sparkles; title: string; description: string }[];
  explanation: string;
}> = {
  setup: {
    explanation: "This step helps personalize your experience by gathering information specific to you.",
    benefits: [
      { icon: Sparkles, title: "Personalized", description: "Tailored to your preferences" },
      { icon: CheckCircle2, title: "Quick", description: "Takes just a minute" },
      { icon: Info, title: "Flexible", description: "Update anytime" },
    ],
  },
  integration: {
    explanation: "Securely connects to external services to automatically sync your data without manual input.",
    benefits: [
      { icon: Shield, title: "Secure", description: "OAuth 2.0 protected" },
      { icon: Zap, title: "Automatic", description: "Syncs in background" },
      { icon: CheckCircle2, title: "Reliable", description: "Always up to date" },
    ],
  },
  save: {
    explanation: "Your information is securely saved to your XD Brain, making it available across all your connected experiences.",
    benefits: [
      { icon: Shield, title: "Encrypted", description: "End-to-end security" },
      { icon: Zap, title: "Instant", description: "Available immediately" },
      { icon: Sparkles, title: "Smart", description: "AI-enhanced recall" },
    ],
  },
};

export function StepDetailSheet({ open, onOpenChange, step }: StepDetailSheetProps) {
  if (!step) return null;

  const Icon = step.icon;
  const details = stepTypeDetails[step.type] || stepTypeDetails.setup;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl px-5 pb-safe max-h-[75vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 bg-muted rounded-full" />
        </div>

        {/* Header with icon */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
            {step.iconUrl ? (
              <img src={step.iconUrl} alt={step.title} className="w-8 h-8 object-contain" />
            ) : Icon ? (
              <Icon className="w-7 h-7 text-foreground/70" />
            ) : (
              <Sparkles className="w-7 h-7 text-foreground/70" />
            )}
          </div>
          <SheetHeader className="text-left flex-1">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-xl">{step.title}</SheetTitle>
              {step.badge && (
                <Badge 
                  variant="secondary" 
                  className="text-[10px] px-2 py-0.5 bg-orange-100 text-orange-600 font-semibold"
                >
                  {step.badge}
                </Badge>
              )}
            </div>
            <SheetDescription className="text-base">
              {step.description}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Explanation */}
        <div className="bg-muted/50 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground/80 leading-relaxed">
              {details.explanation}
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            What to expect
          </h3>
          <div className="space-y-3">
            {details.benefits.map((benefit) => {
              const BenefitIcon = benefit.icon;
              return (
                <div
                  key={benefit.title}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BenefitIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step type indicator */}
        <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
          <span className={cn(
            "text-xs font-medium px-3 py-1.5 rounded-full",
            step.type === "save" && "bg-green-100 text-green-700",
            step.type === "integration" && "bg-blue-100 text-blue-700",
            step.type === "setup" && "bg-purple-100 text-purple-700"
          )}>
            {step.type === "save" && "Final Step"}
            {step.type === "integration" && "Integration Step"}
            {step.type === "setup" && "Setup Step"}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
