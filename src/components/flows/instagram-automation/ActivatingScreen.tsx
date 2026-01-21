import { Loader2, Zap } from "lucide-react";

export function ActivatingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background flex items-center justify-center border-2 border-background">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Activating Monitoring</h2>
          <p className="text-muted-foreground max-w-xs">
            Setting up automatic tracking for your Instagram activity...
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>This only takes a moment</span>
        </div>
      </div>
    </div>
  );
}
