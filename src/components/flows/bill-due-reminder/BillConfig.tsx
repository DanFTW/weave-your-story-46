import { useState, useEffect } from "react";
import { Receipt, Mail, Zap, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePhonePrefill } from "@/hooks/usePhonePrefill";

interface BillConfigProps {
  onActivate: (phoneNumber: string) => Promise<void>;
  isActivating: boolean;
  currentPhone: string | null;
}

export function BillConfig({ onActivate, isActivating, currentPhone }: BillConfigProps) {
  const { phone, isLoading: phoneLoading } = usePhonePrefill(currentPhone);
  const [phoneValue, setPhoneValue] = useState(phone || "");

  // Sync when prefill resolves
  useEffect(() => {
    if (phone && !phoneValue) setPhoneValue(phone);
  }, [phone]);

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
              <p className="font-medium text-foreground text-sm">Texts you a summary</p>
              <p className="text-muted-foreground text-sm">
                Each bill found is sent to your phone as a text message so you never miss a payment
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phone number */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Phone number for bill alerts
        </label>
        <Input
          type="tel"
          placeholder={phoneLoading ? "Looking up your number…" : "+1 (555) 123-4567"}
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
          className="h-[52px] rounded-2xl"
          disabled={phoneLoading}
        />
        <p className="text-xs text-muted-foreground">
          You'll receive a text for each bill detected in your Gmail
        </p>
      </div>

      {/* Activate */}
      <Button
        onClick={() => onActivate(phoneValue)}
        disabled={isActivating || !phoneValue.trim() || phoneLoading}
        className="w-full h-14 rounded-2xl text-base font-bold"
      >
        {isActivating ? "Activating…" : "Activate Bill Scanner"}
      </Button>
    </div>
  );
}
