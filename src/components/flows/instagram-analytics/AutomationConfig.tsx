import { BarChart3, Loader2 } from "lucide-react";
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
          <div className="w-10 h-10 rounded-lg bg-[#E1306C]/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-[#E1306C]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Analytics Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically save your Instagram analytics as memories. Track how your profile performs over time with profile views, reach, follower count, and more.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-2">What gets tracked</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E1306C]" />
            Profile views &amp; impressions
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E1306C]" />
            Reach &amp; engagement metrics
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E1306C]" />
            Follower count snapshots
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E1306C]" />
            Deduplicated — each snapshot saved only once
          </li>
        </ul>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-12 bg-[#E1306C] hover:bg-[#E1306C]/90 text-white"
      >
        {isActivating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Activating...
          </>
        ) : (
          "Activate Analytics Tracking"
        )}
      </Button>
    </div>
  );
}
