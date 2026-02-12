import { Mic, Pause, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FirefliesAutomationStats } from "@/types/firefliesAutomation";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ActiveMonitoringProps {
  stats: FirefliesAutomationStats;
  onPause: () => void;
}

export function ActiveMonitoring({ stats, onPause }: ActiveMonitoringProps) {
  const { toast } = useToast();
  const [showSecret, setShowSecret] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Monitoring Active</h3>
            <p className="text-sm text-muted-foreground">
              {stats.lastReceivedAt
                ? `Last transcript ${formatDistanceToNow(new Date(stats.lastReceivedAt), { addSuffix: true })}`
                : "Waiting for first transcript"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.transcriptsSaved}</div>
            <div className="text-xs text-muted-foreground mt-1">Transcripts Saved</div>
          </div>
        </div>
      </div>

      {/* Webhook URL */}
      {stats.webhookUrl && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h4 className="font-medium text-foreground">Webhook Setup</h4>
          <p className="text-xs text-muted-foreground">
            Paste these into Fireflies → Developer Settings → Webhook → "Transcription Completed"
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted/50 rounded-lg px-3 py-2 text-foreground break-all">
                  {stats.webhookUrl}
                </code>
                <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(stats.webhookUrl!, "Webhook URL")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {stats.webhookSecret && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Secret</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted/50 rounded-lg px-3 py-2 text-foreground break-all">
                    {showSecret ? stats.webhookSecret : "••••••••••••••••"}
                  </code>
                  <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" className="flex-shrink-0" onClick={() => copyToClipboard(stats.webhookSecret!, "Secret")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monitoring badge */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-medium text-foreground mb-3">Monitoring</h4>
        <div className="flex items-center gap-3 text-sm">
          <div className="w-8 h-8 rounded-lg bg-[#6C3AED]/10 flex items-center justify-center">
            <Mic className="w-4 h-4 text-[#6C3AED]" />
          </div>
          <span className="text-foreground">New Transcripts</span>
          <span className="ml-auto text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      <Button variant="outline" onClick={onPause} className="w-full">
        <Pause className="w-4 h-4 mr-2" />
        Pause
      </Button>
    </div>
  );
}
