import { PageHeader } from "@/components/PageHeader";

export default function Integrations() {
  return (
    <div className="pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Integrations" 
          subtitle="Connect your apps" 
        />
        
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Connect apps like Gmail, Calendar, and more to automatically generate memories.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
