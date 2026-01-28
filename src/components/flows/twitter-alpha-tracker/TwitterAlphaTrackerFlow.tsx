import { useTwitterAlphaTracker } from "@/hooks/useTwitterAlphaTracker";
import { AccountSearch } from "./AccountSearch";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";
import { Loader2 } from "lucide-react";

export function TwitterAlphaTrackerFlow() {
  const {
    phase,
    isLoading,
    isSearching,
    isActivating,
    searchResults,
    selectedAccount,
    stats,
    searchUsers,
    selectAccount,
    activateTracking,
    deactivateTracking,
    manualPoll,
    changeAccount,
  } = useTwitterAlphaTracker();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Activating state
  if (phase === "activating") {
    return <ActivatingScreen />;
  }

  // Select account phase
  if (phase === "select-account") {
    return (
      <AccountSearch
        onSearch={searchUsers}
        onSelect={selectAccount}
        searchResults={searchResults}
        isSearching={isSearching}
      />
    );
  }

  // Configure phase
  if (phase === "configure" && selectedAccount) {
    return (
      <AutomationConfig
        account={selectedAccount}
        onActivate={activateTracking}
        onChangeAccount={changeAccount}
        isActivating={isActivating}
      />
    );
  }

  // Active phase
  if (phase === "active" && stats.trackedAccount) {
    return (
      <ActiveMonitoring
        stats={stats}
        onPause={deactivateTracking}
        onCheckNow={manualPoll}
        onChangeAccount={changeAccount}
      />
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
