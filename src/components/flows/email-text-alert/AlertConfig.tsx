import { useState, useEffect } from "react";
import { Mail, Filter, Phone, Zap, X, Plus, Trash2 } from "lucide-react";
import { EmailTextAlertConfig, SenderRule } from "@/types/emailTextAlert";
import { Button } from "@/components/ui/button";
import { usePhonePrefill } from "@/hooks/usePhonePrefill";

interface AlertConfigProps {
  config: EmailTextAlertConfig;
  onActivate: () => Promise<void>;
  onUpdateConfig: (senderFilter: string, keywordFilter: string, phoneNumber: string) => Promise<void>;
  isActivating: boolean;
}

function parseRules(senderFilter: string | null, keywordFilter: string | null): SenderRule[] {
  if (!senderFilter) return [];
  const trimmed = senderFilter.trim();

  // JSON format
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((r: any) => r.email)
          .map((r: any) => ({
            email: String(r.email).trim(),
            keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
          }));
      }
    } catch { /* fall through to legacy */ }
  }

  // Legacy: flat sender list with global keywords
  const senders = trimmed.split(/\|\|\||,/).map((s) => s.trim()).filter(Boolean);
  const keywords = keywordFilter
    ? keywordFilter.split(/\|\|\||,/).map((k) => k.trim()).filter(Boolean)
    : [];

  return senders.map((email) => ({ email, keywords: [...keywords] }));
}

export function AlertConfig({ config, onActivate, onUpdateConfig, isActivating }: AlertConfigProps) {
  const [rules, setRules] = useState<SenderRule[]>(() => parseRules(config.senderFilter, config.keywordFilter));
  const [newSenderInput, setNewSenderInput] = useState("");
  const [keywordInputs, setKeywordInputs] = useState<Record<number, string>>({});
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber ?? "");

  const { phone: prefillPhone } = usePhonePrefill(config.phoneNumber);

  useEffect(() => {
    if (prefillPhone && !phoneNumber) setPhoneNumber(prefillPhone);
  }, [prefillPhone]);

  const addSender = () => {
    const val = newSenderInput.trim();
    if (val && !rules.some((r) => r.email === val)) {
      setRules((prev) => [...prev, { email: val, keywords: [] }]);
    }
    setNewSenderInput("");
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setKeywordInputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addKeyword = (ruleIndex: number) => {
    const val = (keywordInputs[ruleIndex] ?? "").trim();
    if (!val) return;
    setRules((prev) =>
      prev.map((r, i) =>
        i === ruleIndex && !r.keywords.includes(val)
          ? { ...r, keywords: [...r.keywords, val] }
          : r
      )
    );
    setKeywordInputs((prev) => ({ ...prev, [ruleIndex]: "" }));
  };

  const removeKeyword = (ruleIndex: number, keyword: string) => {
    setRules((prev) =>
      prev.map((r, i) =>
        i === ruleIndex ? { ...r, keywords: r.keywords.filter((k) => k !== keyword) } : r
      )
    );
  };

  const canActivate = phoneNumber.trim().length > 0 && rules.length > 0;

  const handleActivate = async () => {
    const serialized = JSON.stringify(rules);
    await onUpdateConfig(serialized, "", phoneNumber.trim());
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
          <li>• Add sender emails you want to monitor</li>
          <li>• Add keywords for each sender to filter by</li>
          <li>• Matching emails are summarized and sent as text alerts</li>
        </ul>
      </div>

      {/* Sender rules */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail className="w-4 h-4 text-muted-foreground" />
          Sender rules
        </label>

        {rules.map((rule, ruleIndex) => (
          <div key={ruleIndex} className="bg-card rounded-2xl border border-border p-5 space-y-3">
            {/* Sender header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground truncate">{rule.email}</span>
              </div>
              <button
                type="button"
                onClick={() => removeRule(ruleIndex)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
              </button>
            </div>

            {/* Keyword chips */}
            {rule.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rule.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(ruleIndex, kw)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add keyword input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={keywordInputs[ruleIndex] ?? ""}
                onChange={(e) => setKeywordInputs((prev) => ({ ...prev, [ruleIndex]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(ruleIndex); } }}
                placeholder="Add keyword…"
                className="flex-1 h-10 px-3 bg-muted rounded-[14px] text-foreground placeholder:text-muted-foreground/60 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => addKeyword(ruleIndex)}
                disabled={!(keywordInputs[ruleIndex] ?? "").trim()}
                className="shrink-0 h-8 w-8 rounded-full"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {rule.keywords.length === 0 && (
              <p className="text-xs text-muted-foreground">No keywords — all emails from this sender will match</p>
            )}
          </div>
        ))}

        {/* Add new sender */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newSenderInput}
            onChange={(e) => setNewSenderInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSender(); } }}
            placeholder="e.g. boss@company.com"
            className="flex-1 h-[52px] px-4 bg-muted rounded-[20px] text-foreground placeholder:text-muted-foreground/60 text-base outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={addSender}
            disabled={!newSenderInput.trim()}
            className="shrink-0 h-10 w-10 rounded-full"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Add sender emails to monitor, then add keywords for each</p>
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
          Add at least one sender email and enter your phone number to activate
        </p>
      )}
    </div>
  );
}
