

## Add Interest Sync Button to Active Monitoring View

### Problem
Once the event finder is activated, the Interests card in `ActiveMonitoring` is read-only — there's no way to pull in new interests from LIAM memories without deactivating first.

### Solution
Add a sync button to the Interests row in the active view that calls the same `prefill` → merge → `updateConfig` flow used on the setup screen. New interests from LIAM are additively merged (respecting the removed-tags filter), the config table is updated, and the UI reflects the change — all without interrupting the active thread.

### Files Changed

| File | Change |
|---|---|
| `ActiveMonitoring.tsx` | Add `onSyncInterests` callback prop + loading state; render a sync button on the Interests card row |
| `WeeklyEventFinderFlow.tsx` | Implement `handleSyncInterests` that calls `prefill`, merges new tags into existing `config.interests`, calls `updateConfig`, and reloads config; pass it to `ActiveMonitoring` |

### Detail

**`ActiveMonitoring.tsx`**
- New props: `onSyncInterests: () => Promise<void>`, `isSyncingInterests: boolean`
- On the Interests row (Heart icon), add a small `RefreshCw` icon button (matching the setup screen's style: `p-1 rounded-lg hover:bg-muted`) aligned to the right. Shows `Loader2` spinner when syncing.

**`WeeklyEventFinderFlow.tsx`**
- New state: `isSyncingInterests`
- New `handleSyncInterests` function:
  1. Calls `prefill()` to fetch interests from LIAM
  2. Parses result into tags, filters through `useRemovedInterestTags.filterRemoved`
  3. Merges with existing `config.interests` tags (additive, case-insensitive dedup)
  4. Calls `updateConfig(mergedInterests, ...)` with all other config fields unchanged
  5. Calls `loadConfig()` to refresh the UI
- Passes `onSyncInterests` and `isSyncingInterests` to `ActiveMonitoring`

This reuses the existing `prefill` edge function action, `parseInterestsToTags` utility, removed-tags filter, and `updateConfig` flow — no new APIs or edge function changes needed.

