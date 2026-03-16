import { useState, useEffect } from "react";
import { BarChart3, Pause, RefreshCw, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstagramAnalyticsStats } from "@/types/instagramAnalytics";
import { formatDistanceToNow, parse, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface InsightMetric {
  name: string;
  value: string | number;
}

interface HistoryItem {
  id: string;
  dedupeKey: string;
  createdAt: string;
  metrics: InsightMetric[];
}

interface ActiveMonitoringProps {
  stats: InstagramAnalyticsStats;
  onPause: () => void;
  onCheckNow: () => void;
  isPolling?: boolean;
}

function extractDateLabel(dedupeKey: string): string {
  try {
    const datePart = dedupeKey.replace("insights_", "");
    const parsed = parse(datePart, "yyyy-MM-dd", new Date());
    return format(parsed, "MMMM d, yyyy");
  } catch {
    return dedupeKey;
  }
}

// deno-lint-ignore no-explicit-any
function parseInsightsData(data: any): InsightMetric[] {
  if (!data) return [];

  const orderedKeys = ["reach", "follower_count", "impressions", "views", "comments", "likes"];
  const allowedMetrics: Record<string, string> = {
    reach: "Reach",
    follower_count: "Follower Count",
    impressions: "Impressions",
    views: "Views",
    comments: "Comments",
    likes: "Likes",
  };

  // Unwrap Instagram API wrapper: { data: [...], paging: ... }
  let metricsArray = data;
  if (!Array.isArray(data) && typeof data === "object" && Array.isArray(data.data)) {
    metricsArray = data.data;
  }

  if (!Array.isArray(metricsArray)) return [];

  const metrics: InsightMetric[] = [];
  for (const m of metricsArray) {
    const name = m.name;
    if (!name || !allowedMetrics[name]) continue;
    const value = m.values?.[0]?.value ?? m.value ?? "N/A";
    if (typeof value === "object") continue;
    metrics.push({ name: allowedMetrics[name], value: typeof value === "number" ? value : String(value) });
  }
  return metrics;
}

export function ActiveMonitoring({ stats, onPause, onCheckNow, isPolling }: ActiveMonitoringProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setHistoryLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("instagram_analytics_processed")
          .select("id, dedupe_key, created_at, insights_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          setHistory(data.map((r: any) => ({
            id: r.id,
            dedupeKey: r.dedupe_key,
            createdAt: r.created_at,
            metrics: parseInsightsData(r.insights_data),
          })));
        }
      } catch (err) {
        console.error("Error fetching analytics history:", err);
      } finally {
        setHistoryLoading(false);
      }
    }
    fetchHistory();
  }, [stats.insightsCollected]);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monitoring Active</h3>
            <p className="text-sm text-muted-foreground">
              {stats.lastPolledAt
                ? `Last checked ${formatDistanceToNow(new Date(stats.lastPolledAt), { addSuffix: true })}`
                : "Tracking Instagram analytics"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.insightsCollected}</div>
            <div className="text-xs text-muted-foreground mt-1">Insights Collected</div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">Monitoring</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-lg bg-[#E1306C]/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-[#E1306C]" />
          </div>
          <span className="text-foreground">User Insights</span>
          <span className="ml-auto text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      {/* Collection History */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-foreground">Collection History</h4>
          {history.length > 0 && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {history.length}
            </span>
          )}
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No insights collected yet
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-muted/50 px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E1306C]/10 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-[#E1306C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{extractDateLabel(item.dedupeKey)}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {item.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2 ml-11">
                    {item.metrics.map((m, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted-foreground">{m.name}: </span>
                        <span className="font-medium text-foreground">{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCheckNow} disabled={isPolling} className="flex-1">
          <RefreshCw className={`w-4 h-4 mr-2 ${isPolling ? 'animate-spin' : ''}`} />
          {isPolling ? 'Checking...' : 'Check Now'}
        </Button>
        <Button variant="outline" onClick={onPause} className="flex-1">
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      </div>
    </div>
  );
}
