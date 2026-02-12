import { FileText, Loader2 } from "lucide-react";
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
          <div className="w-10 h-10 rounded-lg bg-[#4285F4]/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[#4285F4]" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">Document Monitoring</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, every new Google Docs document in your Drive will be automatically saved as a memory including its full text content.
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-12 bg-[#4285F4] hover:bg-[#4285F4]/90 text-white"
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
