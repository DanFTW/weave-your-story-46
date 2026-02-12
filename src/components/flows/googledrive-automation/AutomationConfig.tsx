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
              Automatically save new Google Docs as memories. When a document is created, we'll capture its content in real-time.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-foreground">New Documents</p>
            <p className="text-sm text-muted-foreground">Save when Google Docs are created</p>
          </div>
          <div className="text-xs bg-[#4285F4]/10 text-[#4285F4] px-2 py-1 rounded-full font-medium">
            Webhook
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
