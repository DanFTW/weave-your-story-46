import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlackWorkspace } from "@/types/slackMessagesSync";

interface WorkspacePickerProps {
  workspace: SlackWorkspace | null;
  isLoading: boolean;
  hasError?: boolean;
  onSelectWorkspace: (workspace: SlackWorkspace) => void;
  onRefresh: () => void;
}

export function WorkspacePicker({ workspace, isLoading, hasError, onSelectWorkspace, onRefresh }: WorkspacePickerProps) {
  if (isLoading && !workspace) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your workspace...</p>
      </div>
    );
  }

  if (!isLoading && !workspace && hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-foreground font-medium mb-2">Failed to load workspace</p>
        <p className="text-muted-foreground text-sm text-center mb-4">
          Could not connect to Slack. This may be a temporary issue.
        </p>
        <Button onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Try Again
        </Button>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">No workspace found</p>
        <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Choose which workspace to monitor.
        </p>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        <button
          onClick={() => onSelectWorkspace(workspace)}
          className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0">
            {workspace.icon ? (
              <img
                src={workspace.icon}
                alt={workspace.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <span className="text-white font-bold text-lg">
                {workspace.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">{workspace.name}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
