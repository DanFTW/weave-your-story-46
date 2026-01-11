import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";

export default function Profile() {
  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-5 pt-14">
        <PageHeader 
          title="Profile" 
          subtitle="Manage your account" 
        />
        
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl bg-card p-6 border border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Your profile settings will appear here.
            </p>
          </div>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
