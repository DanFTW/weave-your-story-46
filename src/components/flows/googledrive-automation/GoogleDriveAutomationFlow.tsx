import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useGoogleDriveAutomation } from "@/hooks/useGoogleDriveAutomation";
import { MonitorToggle } from "./MonitorToggle";
import { DocumentSearch } from "./DocumentSearch";
import { ActivatingScreen } from "./ActivatingScreen";
import { cn } from "@/lib/utils";

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
    loadConfig, activateMonitoring, deactivateMonitoring,
    searchDocs, saveDocument,
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

  const handleBack = () => navigate('/threads');

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
            <h1 className="text-xl font-bold text-white truncate">Google Drive Document Tracker</h1>
            <p className="text-white/70 text-sm truncate">Document tracker</p>
          </div>
        </div>
      </div>

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
          onSave={saveDocument}
        />
      </div>
    </div>
  );
}
