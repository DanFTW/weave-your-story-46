import { Loader2, Calendar } from "lucide-react";

export function ActivatingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Calendar className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Activating Calendar Sync</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Setting up automatic event creation from your memories…
        </p>
      </div>
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}
