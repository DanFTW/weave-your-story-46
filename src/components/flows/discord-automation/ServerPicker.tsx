import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscordServer } from "@/types/discordAutomation";

interface ServerPickerProps {
  servers: DiscordServer[];
  isLoading: boolean;
  hasError?: boolean;
  onSelectServer: (server: DiscordServer) => void;
  onRefresh: () => void;
}

export function ServerPicker({ servers, isLoading, hasError, onSelectServer, onRefresh }: ServerPickerProps) {
  if (isLoading && servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading your servers...</p>
      </div>
    );
  }

  if (!isLoading && servers.length === 0 && hasError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-foreground font-medium mb-2">Failed to load servers</p>
        <p className="text-muted-foreground text-sm text-center mb-4">
          Could not connect to Discord. This may be a temporary issue.
        </p>
        <Button onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Try Again
        </Button>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 rounded-full bg-[#5865F2]/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#5865F2]" viewBox="0 0 127.14 96.36" fill="currentColor">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
          </svg>
        </div>
        <p className="text-muted-foreground mb-4">No servers found</p>
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
          Choose which server to monitor for new messages.
        </p>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid gap-3">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => onSelectServer(server)}
            className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-lg bg-[#5865F2] flex items-center justify-center flex-shrink-0">
              {server.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`}
                  alt={server.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {server.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{server.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
