import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FacebookSyncConfigProps {
  onStartSync: () => void;
}

export function FacebookSyncConfig({ onStartSync }: FacebookSyncConfigProps) {
  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          Import your Facebook posts as searchable memories. Each post becomes a memory 
          with its full text, date, and metadata. Duplicates are automatically skipped.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="font-medium">What gets imported</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            All your Facebook posts with text content
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            Post timestamps and permalinks for traceability
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            Run again anytime to catch new posts — no duplicates
          </li>
        </ul>
      </div>

      <Button
        onClick={onStartSync}
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-[#1877F2] to-[#0062E0] hover:from-[#166FE5] hover:to-[#0058CC] text-white"
      >
        Dump Posts Now
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}
