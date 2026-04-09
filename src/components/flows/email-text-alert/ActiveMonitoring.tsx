import { useState } from "react";
import { Mail, Phone, Pause, RefreshCw, Loader2, Bell, ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmailTextAlertStats, EmailTextAlertConfig, SenderRule, ProcessedAlert } from "@/types/emailTextAlert";
import { AlertCard } from "./AlertCard";

interface ActiveMonitoringProps {
  stats: EmailTextAlertStats;
  config: EmailTextAlertConfig;
  alerts: ProcessedAlert[];
  onPause: () => Promise<boolean>;
  onManualSync: () => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
  isSyncing: boolean;
}

function parseSenderRules(senderFilter: string | null): SenderRule[] {
  if (!senderFilter) return [];
  const trimmed = senderFilter.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((r: any) => r.email).map((r: any) => ({
          email: String(r.email),
          keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [],
        }));
      }
    } catch { /* fallback */ }
  }
  return [];
}

function formatRulesSummary(config: EmailTextAlertConfig): string {
  const rules = parseSenderRules(config.senderFilter);
  if (rules.length > 0) {
    return rules
      .map((r) => `${r.email}${r.keywords.length > 0 ? ` (${r.keywords.length} keyword${r.keywords.length !== 1 ? "s" : ""})` : ""}`)
      .join(", ");
  }
  return config.senderFilter || "Any sender";
}

export function ActiveMonitoring({ stats, config, alerts, onPause, onManualSync, onDeleteAlert, isSyncing }: ActiveMonitoringProps) {
  const [alertsOpen, setAlertsOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Email Alerts</h3>
              <p className="text-muted-foreground text-sm">
                {stats.isActive ? "Active" : "Paused"}
              </p>
            </div>
          </div>
          <Switch
            checked={stats.isActive}
            onCheckedChange={(checked) => {
              if (!checked) onPause();
            }}
          />
        </div>
      </div>

      {/* Config summary */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Monitoring</p>
            <p className="text-sm font-semibold text-foreground">
              {formatRulesSummary(config)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Alerts to</p>
            <p className="text-sm font-semibold text-foreground truncate">{config.phoneNumber}</p>
          </div>
        </div>
      </div>

      {/* Alerts history — collapsible */}
      <Collapsible open={alertsOpen} onOpenChange={setAlertsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/30 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-foreground text-base">Alerts sent</p>
              <p className="text-sm text-muted-foreground">{stats.alertsSent} alert{stats.alertsSent !== 1 ? "s" : ""}</p>
            </div>
            {alertsOpen ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-3">
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No alerts yet. Run a sync to check for matching emails.
              </p>
            ) : (
              alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onDelete={onDeleteAlert} />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Sync now */}
      <button
        onClick={onManualSync}
        disabled={isSyncing}
        className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/50 transition-colors disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground text-base">
            {isSyncing ? "Syncing…" : "Sync now"}
          </p>
          <p className="text-sm text-muted-foreground">
            Scan recent emails for matches
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause email alerts
      </button>
    </div>
  );
}
