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
    selectedAccounts,
    stats,
    searchUsers,
    addAccount,
    removeSelectedAccount,
    confirmAccountSelection,
    removeTrackedAccount,
    activateTracking,
    deactivateTracking,
    manualPoll,
    resetSync,
    goToAddAccounts,
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
        onAddAccount={addAccount}
        onRemoveAccount={removeSelectedAccount}
        onConfirm={confirmAccountSelection}
        searchResults={searchResults}
        selectedAccounts={selectedAccounts}
        existingAccounts={stats.trackedAccounts}
        isSearching={isSearching}
        isConfirming={isActivating}
      />
    );
  }

  // Configure phase
  if (phase === "configure" && stats.trackedAccounts.length > 0) {
    return (
      <AutomationConfig
        accounts={stats.trackedAccounts}
        onActivate={activateTracking}
        onAddMore={goToAddAccounts}
        onRemoveAccount={removeTrackedAccount}
        isActivating={isActivating}
      />
    );
  }

  // Active phase
  if (phase === "active" && stats.trackedAccounts.length > 0) {
    return (
      <ActiveMonitoring
        stats={stats}
        onPause={deactivateTracking}
        onCheckNow={manualPoll}
        onAddAccount={goToAddAccounts}
        onRemoveAccount={removeTrackedAccount}
        onResetSync={resetSync}
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
