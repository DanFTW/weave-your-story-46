import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Globe } from "lucide-react";
import { useWebsiteScrape } from "@/hooks/useWebsiteScrape";
import { WebsiteUrlInput } from "./WebsiteUrlInput";
import { ScrapingScreen } from "./ScrapingScreen";
import { WebsiteScrapeSuccess } from "./WebsiteScrapeSuccess";
import { MemoryPreviewCard } from "@/components/flows/MemoryPreviewCard";
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

  return (
    <div ref={ref} className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0AC7D3] to-[#0AC7D3]/70" />
        <div className="relative z-10 px-4 pt-12 pb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Website Link to Memory</h1>
              <p className="text-sm text-white/70">Extract memories from any webpage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Phase content */}
      {phase === 'input' && (
        <WebsiteUrlInput onSubmit={scrapeAndGenerate} />
      )}

      {(phase === 'scraping' || phase === 'generating') && (
        <ScrapingScreen phase={phase} />
      )}

      {phase === 'preview' && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">
              {activeMemories.length} {activeMemories.length === 1 ? 'memory' : 'memories'} extracted — tap to edit, swipe to remove
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-24">
            <AnimatePresence>
              {generatedMemories.map((memory, index) => (
                !memory.isDeleted && (
                  <motion.div
                    key={memory.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -200 }}
                    transition={{ delay: index * 0.05 }}
                    className="mb-3"
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

          {/* Fixed confirm button */}
          <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-4">
            <button
              onClick={confirmMemories}
              disabled={activeMemories.length === 0 || isSaving}
              className="w-full h-[52px] rounded-[18px] font-bold text-base text-white disabled:opacity-40 transition-all"
              style={{
                padding: '2px',
                background: activeMemories.length > 0 && !isSaving
                  ? 'radial-gradient(ellipse 108.65% 103.45% at 50.00% 109.62%, #FF543E 0%, #1050C5 60%)'
                  : undefined,
                backgroundColor: activeMemories.length > 0 && !isSaving ? undefined : 'hsl(var(--muted))',
              }}
            >
              <div
                className="w-full h-full rounded-[16px] flex items-center justify-center"
                style={{
                  background: activeMemories.length > 0 && !isSaving
                    ? 'radial-gradient(ellipse 100.00% 52.73% at 50.00% 0.00%, #1074C5 0%, rgba(16, 79, 197, 0.50) 100%)'
                    : undefined,
                }}
              >
                {isSaving ? 'Saving...' : `Confirm & Save ${activeMemories.length} ${activeMemories.length === 1 ? 'Memory' : 'Memories'}`}
              </div>
            </button>
          </div>
        </div>
      )}

      {phase === 'success' && lastResult && (
        <WebsiteScrapeSuccess
          memoryCount={lastResult.memoryCount}
          url={lastResult.url}
          onScrapeAnother={reset}
          onDone={() => navigate('/threads')}
        />
      )}
    </div>
  );
});
