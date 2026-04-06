import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";

import { useEmailReceiptSheet } from "@/hooks/useEmailReceiptSheet";
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

export function EmailReceiptSheetFlow() {
  const navigate = useNavigate();
  const [isCheckingGmail, setIsCheckingGmail] = useState(true);
  const [isCheckingSheets, setIsCheckingSheets] = useState(true);

  const [isReconnecting, setIsReconnecting] = useState(false);

  const { isConnected: gmailConnected, checkStatus: checkGmail } = useComposio("GMAIL");
  const { isConnected: sheetsConnected, checkStatus: checkSheets, disconnect: disconnectSheets, connect: connectSheets, connecting: sheetsConnecting } = useComposio("GOOGLESHEETS");

  const {
    phase, setPhase, config, stats, spreadsheets,
    isLoading, isActivating, isSyncing, isLoadingSheets, isCreatingSheet,
    loadConfig, listSpreadsheets, createSpreadsheet, updateConfig,
    activate, deactivate, manualSync,
  } = useEmailReceiptSheet();

  // Check Gmail auth first
  useEffect(() => {
    const check = async () => {
      setIsCheckingGmail(true);
      await checkGmail();
      setIsCheckingGmail(false);
    };
    check();
  }, [checkGmail]);

  // If Gmail connected, check Sheets
  useEffect(() => {
    if (!isCheckingGmail && gmailConnected) {
      const check = async () => {
        setIsCheckingSheets(true);
        await checkSheets();
        setIsCheckingSheets(false);
      };
      check();
    } else if (!isCheckingGmail && !gmailConnected) {
      sessionStorage.setItem("returnAfterGmailConnect", "/flow/email-receipt-sheet");
      navigate("/integration/gmail");
    }
  }, [isCheckingGmail, gmailConnected, checkSheets, navigate]);

  // If both connected, load config
  useEffect(() => {
    if (!isCheckingGmail && gmailConnected && !isCheckingSheets && sheetsConnected) {
      loadConfig();
    } else if (!isCheckingGmail && gmailConnected && !isCheckingSheets && !sheetsConnected) {
      sessionStorage.setItem("returnAfterGooglesheetsConnect", "/flow/email-receipt-sheet");
      navigate("/integration/googlesheets");
    }
  }, [isCheckingGmail, gmailConnected, isCheckingSheets, sheetsConnected, loadConfig, navigate]);

  const handleBack = () => navigate("/threads");

  const handleActivate = async () => {
    setPhase("activating");
    const success = await activate();
    if (!success) setPhase("configure");
  };

  if (isCheckingGmail || isCheckingSheets || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  // When sheetsConnecting transitions to false after a reconnect, check if connected
  useEffect(() => {
    if (isReconnecting && !sheetsConnecting) {
      // Polling finished — check if we're now connected
      const verifyReconnect = async () => {
        await checkSheets();
        setIsReconnecting(false);
        // If connected, reload config to resume the flow
        if (sheetsConnected) {
          loadConfig();
        }
      };
      verifyReconnect();
    }
  }, [isReconnecting, sheetsConnecting, checkSheets, sheetsConnected, loadConfig]);

  if (phase === "needs-reconnect") {
    const handleReconnect = async () => {
      setIsReconnecting(true);
      // Best-effort disconnect to clear stale DB row
      try {
        await disconnectSheets();
      } catch {
        // Continue even if disconnect fails
      }
      // Directly start OAuth from this screen — no navigation to IntegrationDetail
      await connectSheets(undefined, true);
    };
    return (
      <div className="min-h-screen bg-background pb-nav">
        <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">Email Receipt to Spreadsheet</h1>
              <p className="text-white/70 text-sm truncate">Reconnection needed</p>
            </div>
          </div>
        </div>
        <div className="px-5 pt-10 flex flex-col items-center text-center gap-4">
          <RefreshCw className={cn("w-12 h-12 text-muted-foreground", (isReconnecting || sheetsConnecting) && "animate-spin")} />
          <h2 className="text-lg font-semibold text-foreground">Google Sheets connection expired</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {isReconnecting || sheetsConnecting
              ? "Reconnecting… please complete the Google sign-in if prompted."
              : "Your Google Sheets token has expired. Please reconnect to continue tracking expenses."}
          </p>
          {!isReconnecting && !sheetsConnecting && (
            <button
              onClick={handleReconnect}
              className="mt-4 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm"
            >
              Reconnect Google Sheets
            </button>
          )}
        </div>
      </div>
    );
  }

  const getSubtitle = () => {
    switch (phase) {
      case "configure": return "Set up tracking";
      case "active": return "Tracking active";
      default: return "Expense tracking";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.teal)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Email Receipt to Spreadsheet</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {phase === "configure" && config && (
          <AutomationConfig
            config={config}
            spreadsheets={spreadsheets}
            onActivate={handleActivate}
            onSelectSheet={updateConfig}
            onLoadSheets={listSpreadsheets}
            onCreateSheet={createSpreadsheet}
            isActivating={isActivating}
            isLoadingSheets={isLoadingSheets}
            isCreatingSheet={isCreatingSheet}
          />
        )}
        {phase === "active" && (
          <ActiveMonitoring
            stats={stats}
            sheetName={config?.spreadsheetName ?? "Unknown"}
            onPause={deactivate}
            onManualSync={manualSync}
            isSyncing={isSyncing}
          />
        )}
      </div>
    </div>
  );
}
