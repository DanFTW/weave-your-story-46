import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, FileText, Check } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useGoogleDriveAutomation } from "@/hooks/useGoogleDriveAutomation";
import { MonitorToggle } from "./MonitorToggle";
import { DocumentSearch } from "./DocumentSearch";
import { ActivatingScreen } from "./ActivatingScreen";
import { GoogleDriveGeneratingScreen } from "./GoogleDriveGeneratingScreen";
import { GoogleDriveSuccess } from "./GoogleDriveSuccess";
import { MemoryPreviewCard } from "@/components/flows/MemoryPreviewCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function GoogleDriveAutomationFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { isConnected, checkStatus } = useComposio('GOOGLEDRIVE');

  const {
    phase, setPhase, config, stats, isLoading, isActivating,
    isSearching, searchResults, isSaving,
    generatedMemories, selectedDoc, isConfirming, savedCount,
    loadConfig, activateMonitoring, deactivateMonitoring,
    searchDocs, generateFromDoc,
    updateMemory, deleteMemory, toggleEdit, updateTag,
    confirmMemories, resetToReady,
  } = useGoogleDriveAutomation();

  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      await checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [checkStatus]);

  useEffect(() => {
    if (!isCheckingAuth && isConnected) {
      loadConfig();
    } else if (!isCheckingAuth && !isConnected) {
      sessionStorage.setItem('returnAfterGoogledriveConnect', '/flow/googledrive-tracker');
      navigate('/integration/googledrive');
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate]);

  const handleBack = () => {
    if (phase === 'preview') {
      resetToReady();
    } else {
      navigate('/threads');
    }
  };

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      setPhase('activating');
      const success = await activateMonitoring();
      if (!success) setPhase('ready');
    } else {
      await deactivateMonitoring();
    }
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4285F4] animate-spin" />
      </div>
    );
  }

  if (phase === 'activating') {
    return <ActivatingScreen />;
  }

  if (phase === 'generating') {
    return <GoogleDriveGeneratingScreen />;
  }

  if (phase === 'success') {
    return (
      <GoogleDriveSuccess
        memoryCount={savedCount}
        docName={selectedDoc?.fileName ?? 'Document'}
        onGenerateAnother={resetToReady}
        onDone={() => navigate('/threads')}
      />
    );
  }

  const activeMemories = generatedMemories.filter(m => !m.isDeleted);

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.blue)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">
              {phase === 'preview' ? 'Review Memories' : 'Google Drive Document Tracker'}
            </h1>
            <p className="text-white/70 text-sm truncate">
              {phase === 'preview'
                ? `${activeMemories.length} memories extracted`
                : 'Document tracker'}
            </p>
          </div>
        </div>
      </div>

      {/* Ready phase: monitor toggle + search */}
      {phase === 'ready' && (
        <div className="px-5 pt-6 space-y-4">
          <MonitorToggle
            isActive={config?.isActive ?? false}
            stats={stats}
            isActivating={isActivating}
            onToggle={handleToggle}
          />
          <DocumentSearch
            isSearching={isSearching}
            searchResults={searchResults}
            isSaving={isSaving}
            onSearch={searchDocs}
            onGenerate={generateFromDoc}
          />
        </div>
      )}

      {/* Preview phase: memory cards */}
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
              disabled={activeMemories.length === 0 || isConfirming}
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
            >
              {isConfirming ? (
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
}
