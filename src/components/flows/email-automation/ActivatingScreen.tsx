import { Loader2, Zap } from "lucide-react";

interface ActivatingScreenProps {
  contactCount: number;
}

export function ActivatingScreen({ contactCount }: ActivatingScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-32 h-32 animate-spin text-primary/20" />
        </div>
      </div>
      
      <h2 className="text-xl font-bold text-foreground mb-2 text-center">
        Setting up automation
      </h2>
      <p className="text-muted-foreground text-center max-w-xs">
        Creating email triggers for {contactCount} contact{contactCount !== 1 ? 's' : ''}...
      </p>
      
      <div className="mt-8 space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          This may take a moment
        </p>
      </div>
    </div>
  );
}
