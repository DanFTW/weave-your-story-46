import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrelloAutomation } from "@/hooks/useTrelloAutomation";
import { BoardPicker } from "./BoardPicker";
import { ListPicker } from "./ListPicker";
import { AutomationConfig } from "./AutomationConfig";
import { ActiveMonitoring } from "./ActiveMonitoring";
import { ActivatingScreen } from "./ActivatingScreen";

export function TrelloAutomationFlow() {
  const navigate = useNavigate();
  const {
    phase,
    setPhase,
    config,
    boards,
    lists,
    isLoading,
    isConnected,
    stats,
    fetchBoards,
    selectBoard,
    selectDoneList,
    updateMonitoringOptions,
    activateMonitoring,
    deactivateMonitoring,
    resetConfig,
  } = useTrelloAutomation();

  // Redirect to Trello integration if not connected
  useEffect(() => {
    if (phase === 'auth-check' && !isLoading && !isConnected) {
      navigate('/integration/trello');
    }
  }, [phase, isLoading, isConnected, navigate]);

  // Fetch boards when entering select-board phase
  useEffect(() => {
    if (phase === 'select-board' && boards.length === 0 && !isLoading) {
      fetchBoards();
    }
  }, [phase, boards.length, isLoading, fetchBoards]);

  // Loading state
  if (phase === 'auth-check' && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Checking connection...</div>
      </div>
    );
  }

  // Activating screen
  if (phase === 'activating') {
    return <ActivatingScreen />;
  }

  // Active monitoring dashboard
  if (phase === 'active') {
    return (
      <ActiveMonitoring
        stats={stats}
        boardName={config?.boardName || 'Unknown Board'}
        doneListName={config?.doneListName || 'Unknown List'}
        onPause={deactivateMonitoring}
        onReset={resetConfig}
        isLoading={isLoading}
      />
    );
  }

  const handleBack = () => {
    if (phase === 'configure') {
      setPhase('select-done-list');
    } else if (phase === 'select-done-list') {
      setPhase('select-board');
    } else {
      navigate('/threads');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-nav">
      {/* Header */}
      <div className={cn("relative px-5 pt-status-bar pb-6 thread-gradient-blue")}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">Trello Task Tracker</h1>
            <p className="text-white/70 text-sm truncate">
              {phase === 'select-board' && 'Select a board to monitor'}
              {phase === 'select-done-list' && 'Select your "Done" list'}
              {phase === 'configure' && 'Configure monitoring'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-5">
        {phase === 'select-board' && (
          <BoardPicker
            boards={boards}
            isLoading={isLoading}
            onSelectBoard={selectBoard}
            onRefresh={fetchBoards}
          />
        )}

        {phase === 'select-done-list' && (
          <ListPicker
            lists={lists}
            isLoading={isLoading}
            boardName={config?.boardName || ''}
            onSelectList={selectDoneList}
          />
        )}

        {phase === 'configure' && config && (
          <AutomationConfig
            config={config}
            onUpdateOptions={updateMonitoringOptions}
            onActivate={activateMonitoring}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
