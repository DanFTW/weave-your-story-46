import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";

export default function Home() {
  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Welcome to Weave" 
          subtitle="Your memories, beautifully connected" 
        />
        
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-card p-6 border border-border/50">
            <h3 className="text-lg font-semibold text-foreground mb-2">Quick Start</h3>
            <p className="text-sm text-muted-foreground">
              Create memories through flows, connect your apps, or add quick notes.
            </p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
