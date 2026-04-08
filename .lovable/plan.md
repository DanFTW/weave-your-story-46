

## Fix: Removed Interest Tags Reappear After Sync

### Problem

When a user removes an interest tag and then refreshes/syncs, the tag reappears because `handleRemoveTag` only updates local React state. The underlying LIAM memory is untouched, so `refreshFromMemories` pulls it right back.

### Solution — Two-pronged defense

**1. Track removed tags locally (immediate, resilient)**

Create a `useRemovedInterestTags` hook following the existing `useDeletedMemories` pattern — a localStorage-backed Set of removed tag strings (lowercased) with 7-day expiry. When `refreshFromMemories` merges tags from LIAM, it filters out any tag present in the removed set. This handles LIAM's eventual consistency and ensures removed tags stay gone across page reloads.

**2. Delete the LIAM memory on removal (permanent cleanup)**

When a user removes a tag, fire-and-forget: list the user's LIAM memories, find any whose content matches the tag (e.g., `"My interests and hobbies include: tech"`), and call `forgetMemory` on each match. This cleans up the source of truth so the tag won't return even after the localStorage entry expires.

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useRemovedInterestTags.ts` | **New** — localStorage-backed Set of removed tag strings with expiry, modeled after `useDeletedMemories` |
| `src/hooks/useInterestSync.ts` | Add `forgetInterestMemory(tag)` — lists memories, finds matches by content, calls `forgetMemory` on each |
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Wire up: `handleRemoveTag` adds tag to removed set + calls `forgetInterestMemory`; `refreshFromMemories` filters out removed tags before merging |

### Detail

**`useRemovedInterestTags` hook:**
- `removedTags: Set<string>` (lowercased)
- `addRemovedTag(tag: string)` — adds to Set + persists to localStorage
- `isRemoved(tag: string): boolean` — case-insensitive check
- `filterRemoved(tags: string[]): string[]` — filters an array of tags
- localStorage key: `weekly_event_finder_removed_tags`, 7-day expiry per entry

**`useInterestSync` additions:**
- New `forgetInterestMemory(tag: string)` function that:
  1. Calls `listMemories()` silently
  2. Finds memories where content matches `"My interests and hobbies include: {tag}"` (case-insensitive)
  3. Calls `forgetMemory(id, true)` for each match (permanent delete)
  4. Fire-and-forget — errors are logged but don't block the UI

**`EventFinderConfig` changes:**
- Import and use `useRemovedInterestTags`
- `handleRemoveTag`: add tag to removed set, fire `forgetInterestMemory(tag)`
- `refreshFromMemories`: after parsing memory tags, run `filterRemoved()` before merging into state

