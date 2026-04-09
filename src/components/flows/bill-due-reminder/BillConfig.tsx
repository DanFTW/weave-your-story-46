import { Receipt, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BillConfigProps {
  onActivate: () => Promise<void>;
  isActivating: boolean;
}

export function BillConfig({ onActivate, isActivating }: BillConfigProps) {
  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-base">How it works</h3>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Scans Gmail</p>
              <p className="text-muted-foreground text-sm">
                Searches for bill notifications, invoices, payment reminders, and statements
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Extracts details</p>
              <p className="text-muted-foreground text-sm">
                AI identifies biller name, amount due, and due date from each email
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">Saves to memory</p>
              <p className="text-muted-foreground text-sm">
                Each bill is saved as a memory so you never miss a payment
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Activate */}
      <Button
        onClick={onActivate}
        disabled={isActivating}
        className="w-full h-14 rounded-2xl text-base font-bold"
      >
        {isActivating ? "Activating…" : "Activate Bill Scanner"}
      </Button>
    </div>
  );
}
