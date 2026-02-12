import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useGoogleDriveAutomation } from "@/hooks/useGoogleDriveAutomation";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
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
    phase, setPhase, config, stats, isLoading, isActivating, isSyncing,
    loadConfig, activateMonitoring, deactivateMonitoring, manualSync,
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

  const handleActivate = async () => {
    setPhase('activating');
    const success = await activateMonitoring();
    if (!success) setPhase('configure');
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

  const getSubtitle = () => {
    switch (phase) {
      case 'configure': return 'Set up monitoring';
      case 'active': return 'Monitoring active';
      default: return 'Document tracker';
    }
  };

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
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {phase === 'configure' && (
          <AutomationConfig
            onActivate={handleActivate}
            isActivating={isActivating}
          />
        )}
        {phase === 'active' && (
          <ActiveMonitoring
            stats={stats}
            onPause={deactivateMonitoring}
            onCheckNow={manualSync}
            isSyncing={isSyncing}
          />
        )}
      </div>
    </div>
  );
}
