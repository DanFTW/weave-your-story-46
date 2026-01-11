import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";

export default function Memories() {
  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Memories" 
          subtitle="All your saved memories" 
        />
        
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Your memories will appear here once you start creating them.
            </p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
