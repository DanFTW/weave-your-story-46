import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useComposio } from "@/hooks/useComposio";
import { useWeeklyEventFinder } from "@/hooks/useWeeklyEventFinder";
import { useRemovedInterestTags } from "@/hooks/useRemovedInterestTags";
import { EventFinderConfig } from "./EventFinderConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { parseAndDeduplicateInterestTags } from "@/utils/interestTagUtils";
import { cn } from "@/lib/utils";

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function WeeklyEventFinderFlow() {
  const navigate = useNavigate();
  const [isCheckingGmail, setIsCheckingGmail] = useState(true);
  const [deliveryNeedsGmail, setDeliveryNeedsGmail] = useState(true);

  const { isConnected: gmailConnected, checkStatus: checkGmail } = useComposio("GMAIL");

  const {
    phase, setPhase, config, stats, events,
    isLoading, isActivating, isSyncing,
    loadConfig, updateConfig, activate, deactivate, manualSync, prefill,
  } = useWeeklyEventFinder();

  const { filterRemoved } = useRemovedInterestTags();
  const [isSyncingInterests, setIsSyncingInterests] = useState(false);

  const handleSyncInterests = useCallback(async () => {
    if (!config) return;
    setIsSyncingInterests(true);
    try {
      const result = await prefill();
      if (!result?.interests) return;

      const memoryTags = filterRemoved(parseAndDeduplicateInterestTags(result.interests));
      const existingTags = config.interests ? parseAndDeduplicateInterestTags(config.interests) : [];
      const lowerSet = new Set(existingTags.map(t => t.toLowerCase()));
      const merged = [...existingTags];
      for (const tag of memoryTags) {
        if (!lowerSet.has(tag.toLowerCase())) {
          merged.push(tag);
          lowerSet.add(tag.toLowerCase());
        }
      }

      const mergedStr = parseAndDeduplicateInterestTags(merged.join(", ")).join(", ");
      if (mergedStr !== config.interests) {
        await updateConfig(
          mergedStr,
          config.location ?? "",
          config.frequency,
          config.deliveryMethod,
          config.email ?? "",
          config.phoneNumber ?? "",
        );
        await loadConfig();
      }
    } finally {
      setIsSyncingInterests(false);
    }
  }, [config, prefill, filterRemoved, updateConfig, loadConfig]);

  useEffect(() => {
    const check = async () => {
      setIsCheckingGmail(true);
      await checkGmail();
      setIsCheckingGmail(false);
    };
    check();
  }, [checkGmail]);

  useEffect(() => {
    if (!isCheckingGmail) {
      // If Gmail not connected, redirect to connect (needed for email delivery)
      if (!gmailConnected) {
        sessionStorage.setItem("returnAfterGmailConnect", "/flow/weekly-event-finder");
        navigate("/integration/gmail");
      } else {
        loadConfig();
      }
    }
  }, [isCheckingGmail, gmailConnected, loadConfig, navigate]);

  const handleBack = () => navigate("/threads");

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
      case "configure": return "Set up your preferences";
      case "active": return "Finding events for you";
      default: return "Event discovery";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className={cn("relative px-5 pt-status-bar pb-6", gradientClasses.purple)}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Weekly Event Finder</h1>
            <p className="text-white/70 text-sm truncate">{getSubtitle()}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {phase === "configure" && config && (
          <EventFinderConfig
            config={config}
            onActivate={handleActivate}
            onUpdateConfig={updateConfig}
            isActivating={isActivating}
            onPrefill={prefill}
          />
        )}
        {phase === "active" && config && (
          <ActiveMonitoring
            stats={stats}
            config={config}
            events={events}
            onPause={deactivate}
            onManualSync={manualSync}
            isSyncing={isSyncing}
            onSyncInterests={handleSyncInterests}
            isSyncingInterests={isSyncingInterests}
          />
        )}
      </div>
    </div>
  );
}
