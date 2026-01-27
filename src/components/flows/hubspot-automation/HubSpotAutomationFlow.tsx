import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useHubSpotAutomation } from "@/hooks/useHubSpotAutomation";
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

export function HubSpotAutomationFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const { 
    isConnected, 
    checkStatus,
  } = useComposio('HUBSPOT');
  
  const {
    phase,
    setPhase,
    config,
    stats,
    isLoading,
    isActivating,
    isPolling,
    loadConfig,
    updateConfig,
    activateMonitoring,
    deactivateMonitoring,
    triggerManualPoll,
  } = useHubSpotAutomation();

  // Check HubSpot connection on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      await checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [checkStatus]);

  // Load config once connection is confirmed
  useEffect(() => {
    if (!isCheckingAuth && isConnected) {
      loadConfig();
    } else if (!isCheckingAuth && !isConnected) {
      // Store return path and redirect to HubSpot integration page
      sessionStorage.setItem('returnAfterHubspotConnect', '/flow/hubspot-tracker');
      navigate('/integration/hubspot');
    }
  }, [isCheckingAuth, isConnected, loadConfig, navigate]);

  const handleBack = () => {
    navigate('/threads');
  };

  const handleActivate = async () => {
    setPhase('activating');
    const success = await activateMonitoring();
    if (!success) {
      setPhase('configure');
    }
  };

  // Loading state
  if (isCheckingAuth || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF7A59] animate-spin" />
      </div>
    );
  }

  // Activating state
  if (phase === 'activating') {
    return <ActivatingScreen />;
  }

  const getSubtitle = () => {
    switch (phase) {
      case 'configure':
        return 'Set up monitoring';
      case 'active':
        return 'Monitoring active';
      default:
        return 'CRM contact tracker';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.orange)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">HubSpot Contact Tracker</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-6">
        {phase === 'configure' && config && (
          <AutomationConfig
            config={config}
            onUpdateConfig={updateConfig}
            onActivate={handleActivate}
            isActivating={isActivating}
          />
        )}

        {phase === 'active' && (
          <ActiveMonitoring
            stats={stats}
            isPolling={isPolling}
            onPause={deactivateMonitoring}
            onCheckNow={triggerManualPoll}
          />
        )}
      </div>
    </div>
  );
}
