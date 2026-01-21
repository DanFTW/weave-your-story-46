import { Loader2, Zap } from "lucide-react";

export function ActivatingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 text-center px-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-10 h-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-bold mb-2">Activating Monitoring</h2>
          <p className="text-muted-foreground">
            Setting up automatic Twitter sync...
          </p>
        </div>
        
        <p className="text-sm text-muted-foreground max-w-xs">
          We're configuring real-time monitoring for your Twitter account. 
          This will only take a moment.
        </p>
      </div>
    </div>
  );
}
