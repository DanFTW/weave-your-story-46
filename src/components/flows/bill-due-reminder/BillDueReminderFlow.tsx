import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useBillDueReminder } from "@/hooks/useBillDueReminder";
import { BillConfig } from "./BillConfig";
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

export function BillDueReminderFlow() {
  const navigate = useNavigate();
  const [isCheckingGmail, setIsCheckingGmail] = useState(true);

  const { isConnected: gmailConnected, checkStatus: checkGmail } = useComposio("GMAIL");

  const {
    phase, setPhase, config, stats, bills,
    isLoading, isActivating, isSyncing,
    loadConfig, activate, deactivate, deleteBill, manualSync,
  } = useBillDueReminder();

  useEffect(() => {
    const check = async () => {
      setIsCheckingGmail(true);
      await checkGmail();
      setIsCheckingGmail(false);
    };
    check();
  }, [checkGmail]);

  useEffect(() => {
    if (!isCheckingGmail && gmailConnected) {
      loadConfig();
    } else if (!isCheckingGmail && !gmailConnected) {
      sessionStorage.setItem("gmailConnectIntent", "bill-due-reminder");
      sessionStorage.setItem("returnAfterGmailConnect", "/flow/bill-due-reminder");
      navigate("/integration/gmail");
    }
  }, [isCheckingGmail, gmailConnected, loadConfig, navigate]);

  const handleBack = () => {
    sessionStorage.removeItem("returnAfterGmailConnect");
    sessionStorage.removeItem("gmailConnectIntent");
    navigate("/threads");
  };

  const handleActivate = async () => {
    setPhase("activating");
    const success = await activate();
    if (!success) setPhase("configure");
  };

  if (isCheckingGmail || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  const getSubtitle = () => {
    switch (phase) {
      case "configure": return "Set up bill scanning";
      case "active": return "Scanning active";
      default: return "Bill reminders";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.orange)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Bill Due Reminder</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {phase === "configure" && config && (
          <BillConfig
            onActivate={handleActivate}
            isActivating={isActivating}
          />
        )}
        {phase === "active" && config && (
          <ActiveMonitoring
            stats={stats}
            bills={bills}
            onPause={deactivate}
            onManualSync={manualSync}
            onDeleteBill={deleteBill}
            isSyncing={isSyncing}
          />
        )}
      </div>
    </div>
  );
}
