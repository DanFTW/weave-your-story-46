import { useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { QuickMemoryFAB } from "@/components/home/QuickMemoryFAB";
import { QuickMemoryDrawer } from "@/components/home/QuickMemoryDrawer";
import { useLiamMemory } from "@/hooks/useLiamMemory";

export default function Home() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { createMemory, isCreating } = useLiamMemory();

  const handleSaveMemory = async (content: string, tag?: string) => {
    return await createMemory(content, tag || 'quick_note');
  };

  return (
    <div className="pb-nav">
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

      <QuickMemoryFAB onClick={() => setDrawerOpen(true)} />
      
      <QuickMemoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSave={handleSaveMemory}
        isSaving={isCreating}
      />
    </div>
  );
}
