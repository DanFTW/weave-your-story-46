import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'weekly_event_finder_removed_tags';
const EXPIRY_DAYS = 7;

interface RemovedTag {
  tag: string; // lowercased
  removedAt: number;
}

/**
 * Tracks interest tags the user has explicitly removed.
 *
 * Persisted to localStorage so removed tags stay hidden across reloads
 * even if LIAM hasn't fully propagated the deletion yet.
 * Entries expire after 7 days (by then the LIAM forget should have taken effect).
 */
export function useRemovedInterestTags() {
  const [removedTags, setRemovedTags] = useState<Set<string>>(new Set());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed: RemovedTag[] = JSON.parse(stored);
      const now = Date.now();
      const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      const valid = parsed.filter(e => now - e.removedAt < expiryMs);
      setRemovedTags(new Set(valid.map(e => e.tag)));

      if (valid.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      }
    } catch (e) {
      console.error('[useRemovedInterestTags] Error loading from localStorage:', e);
    }
  }, []);

  const addRemovedTag = useCallback((tag: string) => {
    const key = tag.toLowerCase().trim();
    if (!key) return;

    setRemovedTags(prev => {
      const next = new Set(prev);
      next.add(key);

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const existing: RemovedTag[] = stored ? JSON.parse(stored) : [];
        if (!existing.some(e => e.tag === key)) {
          existing.push({ tag: key, removedAt: Date.now() });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        }
      } catch (e) {
        console.error('[useRemovedInterestTags] Error persisting:', e);
      }

      return next;
    });
  }, []);

  const isRemoved = useCallback(
    (tag: string) => removedTags.has(tag.toLowerCase().trim()),
    [removedTags],
  );

  const filterRemoved = useCallback(
    (tags: string[]) => tags.filter(t => !removedTags.has(t.toLowerCase().trim())),
    [removedTags],
  );

  /** Remove a tag from the dismissed set (e.g. user re-adds it). */
  const undoRemoval = useCallback((tag: string) => {
    const key = tag.toLowerCase().trim();
    setRemovedTags(prev => {
      const next = new Set(prev);
      next.delete(key);

      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const existing: RemovedTag[] = JSON.parse(stored);
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(existing.filter(e => e.tag !== key)),
          );
        }
      } catch (e) {
        console.error('[useRemovedInterestTags] Error removing entry:', e);
      }

      return next;
    });
  }, []);

  return { removedTags, addRemovedTag, isRemoved, filterRemoved, undoRemoval };
}
