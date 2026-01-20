import { Loader2, Play } from "lucide-react";

export function SyncingScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-5">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
          <Play className="w-10 h-10 text-red-500 fill-red-500" />
        </div>
        <div className="absolute -bottom-1 -right-1">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      </div>
      
      <h2 className="text-xl font-semibold mb-2">Syncing YouTube</h2>
      <p className="text-muted-foreground text-center max-w-xs">
        Fetching your liked videos and creating memories. This may take a moment...
      </p>

      <div className="mt-8 flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>Connecting to YouTube...</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          <span>Fetching videos...</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
          <span>Creating memories...</span>
        </div>
      </div>
    </div>
  );
}
