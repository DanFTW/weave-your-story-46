import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Globe, Check } from "lucide-react";
import { useWebsiteScrape } from "@/hooks/useWebsiteScrape";
import { WebsiteUrlInput } from "./WebsiteUrlInput";
import { ScrapingScreen } from "./ScrapingScreen";
import { WebsiteScrapeSuccess } from "./WebsiteScrapeSuccess";
import { MemoryPreviewCard } from "@/components/flows/MemoryPreviewCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export const WebsiteScrapeFlow = React.forwardRef<HTMLDivElement>(function WebsiteScrapeFlow(_props, ref) {
  const navigate = useNavigate();
  const {
    phase,
    generatedMemories,
    lastResult,
    isSaving,
    scrapeAndGenerate,
    updateMemory,
    deleteMemory,
    toggleEdit,
    updateTag,
    confirmMemories,
    reset,
  } = useWebsiteScrape();

  const handleBack = () => {
    if (phase === 'preview') {
      reset();
    } else {
      navigate('/threads');
    }
  };

  const activeMemories = generatedMemories.filter(m => !m.isDeleted);

  // Scraping / generating phases use full-screen gradient
  if (phase === 'scraping' || phase === 'generating') {
    return <ScrapingScreen phase={phase} />;
  }

  // Success phase is its own full-screen layout
  if (phase === 'success' && lastResult) {
    return (
      <WebsiteScrapeSuccess
        memoryCount={lastResult.memoryCount}
        url={lastResult.url}
        onScrapeAnother={reset}
        onDone={() => navigate('/threads')}
      />
    );
  }

  return (
    <div ref={ref} className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="relative px-5 pt-status-bar pb-6 thread-gradient-teal">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {phase === 'preview' ? 'Review Memories' : 'Website to Memory'}
            </h1>
            <p className="text-white/70 text-sm truncate">
              {phase === 'preview'
                ? `${activeMemories.length} memories extracted`
                : 'Extract memories from any webpage'}
            </p>
          </div>
        </div>
      </div>

      {/* Input phase */}
      {phase === 'input' && (
        <WebsiteUrlInput onSubmit={scrapeAndGenerate} />
      )}

      {/* Preview phase */}
      {phase === 'preview' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 px-5 py-4 pb-32">
            <p className="text-sm text-muted-foreground mb-4">
              Swipe right to delete • Tap to edit
            </p>

            <div className="space-y-3">
              <AnimatePresence>
                {generatedMemories.map((memory, index) => (
                  !memory.isDeleted && (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -200 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <MemoryPreviewCard
                        memory={memory}
                        onDelete={deleteMemory}
                        onUpdate={updateMemory}
                        onToggleEdit={toggleEdit}
                        onUpdateTag={updateTag}
                      />
                    </motion.div>
                  )
                ))}
              </AnimatePresence>
            </div>

            {activeMemories.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  All memories have been removed.
                </p>
              </div>
            )}
          </div>

          {/* Fixed confirm button */}
          <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10">
            <Button
              onClick={confirmMemories}
              disabled={activeMemories.length === 0 || isSaving}
              className="w-full h-12 text-base font-medium gap-2"
            >
              {isSaving ? (
                "Saving..."
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirm & Save
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
