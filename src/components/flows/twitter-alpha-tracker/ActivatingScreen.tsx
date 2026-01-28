import { Loader2, Twitter, Zap } from "lucide-react";

export function ActivatingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center">
          <Twitter className="w-12 h-12 text-[#1DA1F2]" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>

      <Loader2 className="w-8 h-8 text-primary animate-spin mb-6" />

      <h2 className="text-xl font-bold text-foreground mb-2 text-center">
        Activating Alpha Tracker
      </h2>

      <p className="text-muted-foreground text-center max-w-xs">
        Setting up monitoring for new posts...
      </p>
    </div>
  );
}
