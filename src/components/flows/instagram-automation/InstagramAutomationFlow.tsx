import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstagramAutomation } from "@/hooks/useInstagramAutomation";
import { useComposio } from "@/hooks/useComposio";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function InstagramAutomationFlow() {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const instagram = useComposio('INSTAGRAM');
  
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
  } = useInstagramAutomation();

  // Check Instagram connection status
  useEffect(() => {
    const checkAuth = async () => {
      await instagram.checkStatus();
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Handle connection status changes
  useEffect(() => {
    if (isCheckingAuth) return;
    
    if (instagram.isConnected) {
      loadConfig();
    } else {
      // User is not connected, redirect to Instagram integration
      navigate('/integration/instagram');
    }
  }, [instagram.isConnected, isCheckingAuth]);

  const handleBack = () => {
    switch (phase) {
      case 'auth-check':
      case 'configure':
      case 'active':
        navigate('/threads');
        break;
      default:
        navigate('/threads');
    }
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">
            {isCheckingAuth ? "Checking connection..." : "Loading configuration..."}
          </p>
        </div>
      </div>
    );
  }

  // Activating screen
  if (phase === 'activating') {
    return <ActivatingScreen />;
  }

  // Get subtitle based on phase
  const getSubtitle = () => {
    switch (phase) {
      case 'configure':
        return 'Configure what to monitor';
      case 'active':
        return 'Monitoring your Instagram activity';
      default:
        return 'Automatically capture Instagram moments';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.pink)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Instagram Live</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
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
