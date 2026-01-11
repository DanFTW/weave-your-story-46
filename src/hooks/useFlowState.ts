import { useState, useCallback, useEffect } from "react";
import { FlowState, FlowPhase, FlowEntry, GeneratedMemory } from "@/types/flows";

const STORAGE_KEY = 'flow-entries';

const getInitialState = (flowId?: string): FlowState => {
  if (flowId && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}-${flowId}`);
      if (stored) {
        const entries = JSON.parse(stored) as FlowEntry[];
        return {
          phase: entries.length > 0 ? 'list' : 'overview',
          entries,
          editingEntryId: null,
          generatedMemories: [],
          savedMemoryIds: [],
        };
      }
    } catch (e) {
      console.error('Failed to load flow entries:', e);
    }
  }
  return {
    phase: 'overview',
    entries: [],
    editingEntryId: null,
    generatedMemories: [],
    savedMemoryIds: [],
  };
};

export function useFlowState(flowId?: string) {
  const [state, setState] = useState<FlowState>(() => getInitialState(flowId));

  // Persist entries to localStorage
  useEffect(() => {
    if (flowId && state.entries.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}-${flowId}`, JSON.stringify(state.entries));
    }
  }, [flowId, state.entries]);

  const setPhase = useCallback((phase: FlowPhase) => {
    setState(prev => ({ ...prev, phase }));
  }, []);

  const addEntry = useCallback((data: Record<string, string>) => {
    const newEntry: FlowEntry = {
      id: crypto.randomUUID(),
      data,
      createdAt: new Date().toISOString(),
    };
    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry],
      phase: prev.entries.length === 0 ? 'list' : prev.phase,
    }));
    return newEntry;
  }, []);

  const updateEntry = useCallback((entryId: string, data: Record<string, string>) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.map(entry =>
        entry.id === entryId ? { ...entry, data } : entry
      ),
      editingEntryId: null,
      phase: 'list',
    }));
  }, []);

  const deleteEntry = useCallback((entryId: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== entryId),
    }));
  }, []);

  const startEditing = useCallback((entryId: string) => {
    setState(prev => ({
      ...prev,
      editingEntryId: entryId,
      phase: 'editing',
    }));
  }, []);

  const startAdding = useCallback(() => {
    setState(prev => ({
      ...prev,
      editingEntryId: null,
      phase: 'adding',
    }));
  }, []);

  const setGeneratedMemories = useCallback((memories: GeneratedMemory[]) => {
    setState(prev => ({
      ...prev,
      generatedMemories: memories,
      phase: 'preview',
    }));
  }, []);

  const deleteGeneratedMemory = useCallback((memoryId: string) => {
    setState(prev => ({
      ...prev,
      generatedMemories: prev.generatedMemories.filter(m => m.id !== memoryId),
    }));
  }, []);

  const updateGeneratedMemory = useCallback((memoryId: string, content: string) => {
    setState(prev => ({
      ...prev,
      generatedMemories: prev.generatedMemories.map(m =>
        m.id === memoryId ? { ...m, content, isEditing: false } : m
      ),
    }));
  }, []);

  const toggleEditingMemory = useCallback((memoryId: string, isEditing: boolean) => {
    setState(prev => ({
      ...prev,
      generatedMemories: prev.generatedMemories.map(m =>
        m.id === memoryId ? { ...m, isEditing } : m
      ),
    }));
  }, []);

  const updateGeneratedMemoryTag = useCallback((memoryId: string, tag: string) => {
    setState(prev => ({
      ...prev,
      generatedMemories: prev.generatedMemories.map(m =>
        m.id === memoryId ? { ...m, tag } : m
      ),
    }));
  }, []);

  const setSavedMemoryIds = useCallback((ids: string[]) => {
    setState(prev => ({
      ...prev,
      savedMemoryIds: ids,
      phase: 'configured',
    }));
  }, []);

  const goToList = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: prev.entries.length > 0 ? 'list' : 'overview',
      editingEntryId: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(getInitialState(flowId));
    if (flowId) {
      localStorage.removeItem(`${STORAGE_KEY}-${flowId}`);
    }
  }, [flowId]);

  const getEditingEntry = useCallback(() => {
    if (!state.editingEntryId) return null;
    return state.entries.find(e => e.id === state.editingEntryId) || null;
  }, [state.editingEntryId, state.entries]);

  return {
    state,
    setPhase,
    addEntry,
    updateEntry,
    deleteEntry,
    startEditing,
    startAdding,
    setGeneratedMemories,
    deleteGeneratedMemory,
    updateGeneratedMemory,
    updateGeneratedMemoryTag,
    toggleEditingMemory,
    setSavedMemoryIds,
    goToList,
    reset,
    getEditingEntry,
  };
}
