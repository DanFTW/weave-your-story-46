import { Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AutomationConfigProps {
  onActivate: () => void;
  isActivating: boolean;
}

export function AutomationConfig({ onActivate, isActivating }: AutomationConfigProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#6C3AED]/10 flex items-center justify-center flex-shrink-0">
            <Mic className="w-5 h-5 text-[#6C3AED]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Transcript Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, we'll provide a webhook URL to paste into your Fireflies Developer Settings.
              Every new transcript will be automatically saved as a memory.
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-12 bg-[#6C3AED] hover:bg-[#6C3AED]/90 text-white"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          "Activate Monitoring"
        )}
      </Button>
    </div>
  );
}
