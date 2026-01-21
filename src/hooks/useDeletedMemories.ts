import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'liam_deleted_memories';
const EXPIRY_HOURS = 24; // Keep deleted IDs for 24 hours

interface DeletedMemory {
  id: string;
  deletedAt: number;
}

/**
 * Hook to manage locally deleted memories.
 * 
 * This exists because the LIAM API has eventual consistency issues where
 * the forget endpoint returns success but the list endpoint still returns
 * the deleted memory. This hook maintains a local list of deleted memory IDs
 * that persists across page refreshes to ensure consistent UX.
 */
export function useDeletedMemories() {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: DeletedMemory[] = JSON.parse(stored);
        const now = Date.now();
        const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000;
        
        // Filter out expired entries and extract IDs
        const validEntries = parsed.filter(entry => now - entry.deletedAt < expiryMs);
        const validIds = new Set(validEntries.map(entry => entry.id));
        
        setDeletedIds(validIds);
        
        // Update storage if we filtered out any expired entries
        if (validEntries.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validEntries));
        }
      }
    } catch (e) {
      console.error('Error loading deleted memories from localStorage:', e);
    }
  }, []);

  const addDeletedId = useCallback((id: string) => {
    setDeletedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      
      // Persist to localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing: DeletedMemory[] = stored ? JSON.parse(stored) : [];
        const now = Date.now();
        
        // Add new entry if not already present
        if (!existing.some(entry => entry.id === id)) {
          existing.push({ id, deletedAt: now });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        }
      } catch (e) {
        console.error('Error saving deleted memory to localStorage:', e);
      }
      
      return newSet;
    });
  }, []);

  const isDeleted = useCallback((id: string) => {
    return deletedIds.has(id);
  }, [deletedIds]);

  const filterDeleted = useCallback(<T extends { id: string }>(items: T[]): T[] => {
    return items.filter(item => !deletedIds.has(item.id));
  }, [deletedIds]);

  const clearAll = useCallback(() => {
    setDeletedIds(new Set());
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[useDeletedMemories] Cleared all deleted memory IDs from cache');
    } catch (e) {
      console.error('Error clearing deleted memories from localStorage:', e);
    }
  }, []);

  return {
    deletedIds,
    addDeletedId,
    isDeleted,
    filterDeleted,
    clearAll,
  };
}
