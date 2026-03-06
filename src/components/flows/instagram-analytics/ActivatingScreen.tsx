import { Loader2 } from "lucide-react";

export function ActivatingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-[#E1306C]/10 flex items-center justify-center mb-6">
        <Loader2 className="w-8 h-8 text-[#E1306C] animate-spin" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Setting up analytics tracking...</h2>
      <p className="text-muted-foreground text-center text-sm">
        We're connecting to Instagram and fetching your latest analytics data.
      </p>
    </div>
  );
}
