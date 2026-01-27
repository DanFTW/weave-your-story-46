import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  TrelloAutomationPhase, 
  TrelloBoard, 
  TrelloList, 
  TrelloAutomationConfig,
  TrelloAutomationStats
} from "@/types/trelloAutomation";

interface UseTrelloAutomationReturn {
  phase: TrelloAutomationPhase;
  setPhase: (phase: TrelloAutomationPhase) => void;
  config: TrelloAutomationConfig | null;
  boards: TrelloBoard[];
  lists: TrelloList[];
  isLoading: boolean;
  stats: TrelloAutomationStats;
  fetchBoards: () => Promise<void>;
  fetchLists: (boardId: string) => Promise<void>;
  selectBoard: (board: TrelloBoard) => Promise<void>;
  selectDoneList: (list: TrelloList) => Promise<void>;
  updateMonitoringOptions: (options: { monitorNewCards?: boolean; monitorCompletedCards?: boolean }) => Promise<void>;
  activateMonitoring: () => Promise<void>;
  deactivateMonitoring: () => Promise<void>;
  resetConfig: () => Promise<void>;
  initializeAfterAuthCheck: () => Promise<void>;
}

export function useTrelloAutomation(): UseTrelloAutomationReturn {
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<TrelloAutomationPhase>('auth-check');
  const [config, setConfig] = useState<TrelloAutomationConfig | null>(null);
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as true to prevent flash
  const [hasInitialized, setHasInitialized] = useState(false);

  const stats: TrelloAutomationStats = {
    cardsTracked: config?.cardsTracked ?? 0,
    completedTracked: config?.completedTracked ?? 0,
    isActive: config?.isActive ?? false,
  };

  // Load or create config
  const loadConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existingConfig } = await supabase
      .from('trello_automation_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingConfig) {
      setConfig({
        id: existingConfig.id,
        userId: existingConfig.user_id,
        boardId: existingConfig.board_id,
        boardName: existingConfig.board_name,
        doneListId: existingConfig.done_list_id,
        doneListName: existingConfig.done_list_name,
        monitorNewCards: existingConfig.monitor_new_cards ?? true,
        monitorCompletedCards: existingConfig.monitor_completed_cards ?? true,
        isActive: existingConfig.is_active ?? false,
        newCardTriggerId: existingConfig.new_card_trigger_id,
        updatedCardTriggerId: existingConfig.updated_card_trigger_id,
        cardsTracked: existingConfig.cards_tracked ?? 0,
        completedTracked: existingConfig.completed_tracked ?? 0,
      });

      // Determine phase based on config state
      if (existingConfig.is_active) {
        setPhase('active');
      } else if (existingConfig.done_list_id) {
        setPhase('configure');
      } else if (existingConfig.board_id) {
        setPhase('select-done-list');
      } else {
        setPhase('select-board');
      }
    } else {
      setPhase('select-board');
    }
  }, []);

  // Initialize after auth check is complete (called by component)
  const initializeAfterAuthCheck = useCallback(async () => {
    if (hasInitialized) return;
    setHasInitialized(true);
    setIsLoading(true);
    await loadConfig();
    setIsLoading(false);
  }, [hasInitialized, loadConfig]);

  // Note: Initialization is now triggered by the component via initializeAfterAuthCheck
  // This removes the old init useEffect that caused the race condition

  // Fetch user's Trello boards
  const fetchBoards = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trello-automation-triggers', {
        body: { action: 'get-boards' },
      });

      if (error) throw error;
      setBoards(data.boards || []);
    } catch (error) {
      console.error('Failed to fetch boards:', error);
      toast({
        title: "Failed to fetch boards",
        description: "Could not load your Trello boards. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch lists for a board
  const fetchLists = useCallback(async (boardId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trello-automation-triggers', {
        body: { action: 'get-lists', boardId },
      });

      if (error) throw error;
      setLists((data.lists || []).filter((list: TrelloList) => !list.closed));
    } catch (error) {
      console.error('Failed to fetch lists:', error);
      toast({
        title: "Failed to fetch lists",
        description: "Could not load board lists. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Select a board
  const selectBoard = useCallback(async (board: TrelloBoard) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('trello_automation_config')
        .upsert({
          user_id: user.id,
          board_id: board.id,
          board_name: board.name,
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setConfig(prev => prev ? {
        ...prev,
        boardId: board.id,
        boardName: board.name,
      } : {
        id: data.id,
        userId: user.id,
        boardId: board.id,
        boardName: board.name,
        doneListId: null,
        doneListName: null,
        monitorNewCards: true,
        monitorCompletedCards: true,
        isActive: false,
        newCardTriggerId: null,
        updatedCardTriggerId: null,
        cardsTracked: 0,
        completedTracked: 0,
      });

      await fetchLists(board.id);
      setPhase('select-done-list');
    } catch (error) {
      console.error('Failed to save board:', error);
      toast({
        title: "Failed to save board",
        description: "Could not save your board selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchLists, toast]);

  // Select done list
  const selectDoneList = useCallback(async (list: TrelloList) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('trello_automation_config')
        .update({
          done_list_id: list.id,
          done_list_name: list.name,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setConfig(prev => prev ? {
        ...prev,
        doneListId: list.id,
        doneListName: list.name,
      } : null);

      setPhase('configure');
    } catch (error) {
      console.error('Failed to save done list:', error);
      toast({
        title: "Failed to save",
        description: "Could not save your selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Update monitoring options
  const updateMonitoringOptions = useCallback(async (options: { 
    monitorNewCards?: boolean; 
    monitorCompletedCards?: boolean 
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const updates: Record<string, boolean> = {};
      if (options.monitorNewCards !== undefined) {
        updates.monitor_new_cards = options.monitorNewCards;
      }
      if (options.monitorCompletedCards !== undefined) {
        updates.monitor_completed_cards = options.monitorCompletedCards;
      }

      const { error } = await supabase
        .from('trello_automation_config')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setConfig(prev => prev ? { ...prev, ...options } : null);
    } catch (error) {
      console.error('Failed to update options:', error);
      toast({
        title: "Failed to save",
        description: "Could not save your preferences.",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Activate monitoring
  const activateMonitoring = useCallback(async () => {
    if (!config?.boardId) return;

    setPhase('activating');
    try {
      const { data, error } = await supabase.functions.invoke('trello-automation-triggers', {
        body: { 
          action: 'activate',
          boardId: config.boardId,
          doneListId: config.doneListId,
          monitorNewCards: config.monitorNewCards,
          monitorCompletedCards: config.monitorCompletedCards,
        },
      });

      if (error) throw error;

      setConfig(prev => prev ? {
        ...prev,
        isActive: true,
        newCardTriggerId: data.newCardTriggerId,
        updatedCardTriggerId: data.updatedCardTriggerId,
      } : null);

      setPhase('active');
      toast({
        title: "Monitoring activated",
        description: "Your Trello board is now being monitored.",
      });
    } catch (error) {
      console.error('Failed to activate:', error);
      setPhase('configure');
      toast({
        title: "Activation failed",
        description: "Could not start monitoring. Please try again.",
        variant: "destructive",
      });
    }
  }, [config, toast]);

  // Deactivate monitoring
  const deactivateMonitoring = useCallback(async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('trello-automation-triggers', {
        body: { 
          action: 'deactivate',
          newCardTriggerId: config?.newCardTriggerId,
          updatedCardTriggerId: config?.updatedCardTriggerId,
        },
      });

      if (error) throw error;

      setConfig(prev => prev ? {
        ...prev,
        isActive: false,
      } : null);

      setPhase('configure');
      toast({
        title: "Monitoring paused",
        description: "Trello monitoring has been paused.",
      });
    } catch (error) {
      console.error('Failed to deactivate:', error);
      toast({
        title: "Deactivation failed",
        description: "Could not pause monitoring. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, toast]);

  // Reset config
  const resetConfig = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsLoading(true);
    try {
      // First deactivate if active
      if (config?.isActive) {
        await supabase.functions.invoke('trello-automation-triggers', {
          body: { 
            action: 'deactivate',
            newCardTriggerId: config.newCardTriggerId,
            updatedCardTriggerId: config.updatedCardTriggerId,
          },
        });
      }

      // Delete config
      await supabase
        .from('trello_automation_config')
        .delete()
        .eq('user_id', user.id);

      // Delete processed cards
      await supabase
        .from('trello_processed_cards')
        .delete()
        .eq('user_id', user.id);

      setConfig(null);
      setBoards([]);
      setLists([]);
      setPhase('select-board');
    } catch (error) {
      console.error('Failed to reset:', error);
      toast({
        title: "Reset failed",
        description: "Could not reset configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, toast]);

  return {
    phase,
    setPhase,
    config,
    boards,
    lists,
    isLoading,
    stats,
    fetchBoards,
    fetchLists,
    selectBoard,
    selectDoneList,
    updateMonitoringOptions,
    activateMonitoring,
    deactivateMonitoring,
    resetConfig,
    initializeAfterAuthCheck,
  };
}
