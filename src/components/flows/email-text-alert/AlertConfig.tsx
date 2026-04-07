import { useState } from "react";
import { Mail, Filter, Phone, Zap, X, Plus } from "lucide-react";
import { EmailTextAlertConfig } from "@/types/emailTextAlert";
import { Button } from "@/components/ui/button";

interface AlertConfigProps {
  config: EmailTextAlertConfig;
  onActivate: () => Promise<void>;
  onUpdateConfig: (senderFilter: string, keywordFilter: string, phoneNumber: string) => Promise<void>;
  isActivating: boolean;
}

function parseItems(value: string | null): string[] {
  if (!value) return [];
  return value.split(/\|\|\||,/).map((s) => s.trim()).filter(Boolean);
}

export function AlertConfig({ config, onActivate, onUpdateConfig, isActivating }: AlertConfigProps) {
  const [senders, setSenders] = useState<string[]>(() => parseItems(config.senderFilter));
  const [keywords, setKeywords] = useState<string[]>(() => parseItems(config.keywordFilter));
  const [senderInput, setSenderInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber ?? "");

  const addSender = () => {
    const val = senderInput.trim();
    if (val && !senders.includes(val)) {
      setSenders((prev) => [...prev, val]);
    }
    setSenderInput("");
  };

  const removeSender = (item: string) => {
    setSenders((prev) => prev.filter((s) => s !== item));
  };

  const addKeyword = () => {
    const val = keywordInput.trim();
    if (val && !keywords.includes(val)) {
      setKeywords((prev) => [...prev, val]);
    }
    setKeywordInput("");
  };

  const removeKeyword = (item: string) => {
    setKeywords((prev) => prev.filter((k) => k !== item));
  };

  const canActivate = phoneNumber.trim().length > 0 && (senders.length > 0 || keywords.length > 0);

  const handleActivate = async () => {
    await onUpdateConfig(senders.join("|||"), keywords.join("|||"), phoneNumber.trim());
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
        {senders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {senders.map((sender) => (
              <span
                key={sender}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
              >
                {sender}
                <button type="button" onClick={() => removeSender(sender)} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={senderInput}
            onChange={(e) => setSenderInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSender(); } }}
            placeholder="e.g. boss@company.com"
            className="flex-1 h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="button" size="icon" variant="ghost" onClick={addSender} disabled={!senderInput.trim()} className="shrink-0 h-10 w-10 rounded-full">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Email addresses or domains to monitor</p>
      </div>

      {/* Keyword filter */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Keyword filter
        </label>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
              >
                {kw}
                <button type="button" onClick={() => removeKeyword(kw)} className="ml-0.5 hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
            placeholder="e.g. urgent, invoice"
            className="flex-1 h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button type="button" size="icon" variant="ghost" onClick={addKeyword} disabled={!keywordInput.trim()} className="shrink-0 h-10 w-10 rounded-full">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Keywords to match in subject or body</p>
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
