import { Hash, Search, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SyncConfigProps {
  selectedChannelCount: number;
  searchMode: boolean;
  onSearchModeChange: (on: boolean) => void;
  onActivate: () => Promise<void>;
  isLoading: boolean;
}

export function SyncConfig({
  selectedChannelCount,
  searchMode,
  onSearchModeChange,
  onActivate,
  isLoading,
}: SyncConfigProps) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 rounded-xl bg-card border border-border">
        <h3 className="font-medium text-foreground mb-2">Channel Configuration</h3>
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Channels: <span className="text-foreground font-medium">{selectedChannelCount} selected</span>
          </p>
        </div>
      </div>

      {/* Search & Import Toggle */}
      <div className="bg-card rounded-xl border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#4A154B]/10 flex items-center justify-center">
              <Search className="w-5 h-5 text-[#4A154B]" />
            </div>
            <div>
              <p className="font-medium text-foreground">Search & Import</p>
              <p className="text-sm text-muted-foreground">
                {searchMode ? "Active search mode" : "Passive import mode"}
              </p>
            </div>
          </div>
          <Switch checked={searchMode} onCheckedChange={onSearchModeChange} />
        </div>
      </div>

      {/* Mode Explanation */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h3 className="font-medium text-foreground mb-3">How it works</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          {searchMode ? (
            <>
              <li className="flex items-start gap-2">
                <Search className="w-4 h-4 text-[#4A154B] mt-0.5 flex-shrink-0" />
                <span>Uses Slack's search API to find and import content across your selected channels.</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-[#4A154B] mt-0.5 flex-shrink-0" />
                <span>Best for targeted content discovery across large workspaces.</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex items-start gap-2">
                <Hash className="w-4 h-4 text-[#4A154B] mt-0.5 flex-shrink-0" />
                <span>Passively imports recent messages from your selected channels.</span>
              </li>
              <li className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-[#4A154B] mt-0.5 flex-shrink-0" />
                <span>Best for ongoing capture of channel activity as memories.</span>
              </li>
            </>
          )}
        </ul>
      </div>

      {/* Activate Button */}
      <Button
        onClick={onActivate}
        disabled={isLoading}
        className="w-full h-14 text-lg rounded-xl bg-[#4A154B] hover:bg-[#4A154B]/90"
      >
        <Zap className="w-5 h-5 mr-2" />
        Activate Sync
      </Button>
    </div>
  );
}
