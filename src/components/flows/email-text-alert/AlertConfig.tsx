import { useState } from "react";
import { Mail, Filter, Phone, Zap } from "lucide-react";
import { EmailTextAlertConfig } from "@/types/emailTextAlert";

interface AlertConfigProps {
  config: EmailTextAlertConfig;
  onActivate: () => Promise<void>;
  onUpdateConfig: (senderFilter: string, keywordFilter: string, phoneNumber: string) => Promise<void>;
  isActivating: boolean;
}

export function AlertConfig({ config, onActivate, onUpdateConfig, isActivating }: AlertConfigProps) {
  const [senderFilter, setSenderFilter] = useState(config.senderFilter ?? "");
  const [keywordFilter, setKeywordFilter] = useState(config.keywordFilter ?? "");
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber ?? "");

  const canActivate = phoneNumber.trim().length > 0 && (senderFilter.trim().length > 0 || keywordFilter.trim().length > 0);

  const handleActivate = async () => {
    await onUpdateConfig(senderFilter.trim(), keywordFilter.trim(), phoneNumber.trim());
    await onActivate();
  };

  return (
    <div className="space-y-6">
      {/* How it works */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-base">How it works</h3>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Monitors your Gmail for emails matching your rules</li>
          <li>• Generates a short AI summary of each matching email</li>
          <li>• Sends the summary as a text alert to your phone</li>
        </ul>
      </div>

      {/* Sender filter */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="w-4 h-4 text-muted-foreground" />
          Sender filter
        </label>
        <input
          type="text"
          value={senderFilter}
          onChange={(e) => setSenderFilter(e.target.value)}
          placeholder="e.g. boss@company.com, alerts@bank.com"
          className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground">Comma-separated email addresses or domains</p>
      </div>

      {/* Keyword filter */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Keyword filter
        </label>
        <input
          type="text"
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
          placeholder="e.g. urgent, invoice, payment due"
          className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-xs text-muted-foreground">Comma-separated keywords to match in subject or body</p>
      </div>

      {/* Phone number */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Phone className="w-4 h-4 text-muted-foreground" />
          Phone number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="e.g. +1 555 123 4567"
          className="w-full h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Activate button */}
      <button
        onClick={handleActivate}
        disabled={!canActivate || isActivating}
        className="w-full h-[52px] rounded-[18px] bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 transition-opacity"
      >
        {isActivating ? "Activating…" : "Activate Email Alerts"}
      </button>

      {!canActivate && (
        <p className="text-xs text-muted-foreground text-center">
          Enter a phone number and at least one sender or keyword filter to activate
        </p>
      )}
    </div>
  );
}
