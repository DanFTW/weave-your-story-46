

## Bidirectional interests sync with LIAM memories

### Current state

- **Read path**: When the config page opens with no saved interests, `onPrefill` calls the edge function's `prefill` action, which reads LIAM memories server-side using global LIAM keys and regex-matches interest/location content.
- **Write path**: None. When users edit interests and activate, changes are saved only to `weekly_event_finder_config` in Supabase — never written back to LIAM.

### What changes

Make the interests field bidirectional: read from LIAM on open (existing), write back to LIAM on save (new). Use the existing `useLiamMemory` hook's `createMemory` for the write path — it already handles auth, signing, retries, and the `liam-memory` edge function proxy. No new edge function or API endpoint needed.

### Technical plan

#### 1. New utility hook: `src/hooks/useInterestSync.ts`

A small, reusable hook that encapsulates the bidirectional sync logic, keeping `EventFinderConfig` clean:

```typescript
import { useLiamMemory } from "@/hooks/useLiamMemory";

export function useInterestSync() {
  const { createMemory, isCreating } = useLiamMemory();

  /**
   * Saves user interests back to LIAM as a memory tagged "INTEREST/HOBBY".
   * Compares previous vs current to avoid redundant writes.
   * Fires silently — no toast on success.
   */
  const syncInterestsToMemory = async (
    currentInterests: string,
    previousInterests: string | null
  ): Promise<void> => {
    const trimmed = currentInterests.trim();
    if (!trimmed || trimmed === (previousInterests ?? "").trim()) return;

    await createMemory(
      `My interests and hobbies include: ${trimmed}`,
      "INTEREST/HOBBY",
      { silent: true }
    );
  };

  return { syncInterestsToMemory, isSyncing: isCreating };
}
```

Key decisions:
- **Tag**: `INTEREST/HOBBY` — matches the regex the `fetchLiamMemories` function already uses to read interests back (`/interest|hobby/i`).
- **Silent**: Uses `{ silent: true }` to avoid a toast for the background sync.
- **Deduplication**: Compares current vs previous to skip no-op writes.
- **Content format**: `"My interests and hobbies include: ..."` — natural language so the LIAM regex picks it up on next prefill.

#### 2. Update `EventFinderConfig.tsx`

- Import and use `useInterestSync`.
- Store the original prefilled interests in a ref (`prefillRef`) so we can diff on save.
- In `handleActivate`, call `syncInterestsToMemory(interests, prefillRef.current)` before (or in parallel with) the existing `onUpdateConfig` + `onActivate`.
- Also sync location the same way with tag `LOCATION`.

```typescript
// Inside EventFinderConfig
const { syncInterestsToMemory } = useInterestSync();
const prefillRef = useRef<{ interests: string; location: string }>({ interests: "", location: "" });

// In the prefill useEffect, after setting state:
prefillRef.current = { interests: result.interests, location: result.location };

// In handleActivate:
const handleActivate = async () => {
  // Fire-and-forget: sync changed interests/location back to LIAM
  syncInterestsToMemory(interests, prefillRef.current.interests);
  syncLocationToMemory(location, prefillRef.current.location);
  
  await onUpdateConfig(interests.trim(), location.trim(), frequency, deliveryMethod, email.trim(), phoneNumber.trim());
  await onActivate();
};
```

#### 3. Extend `useInterestSync` for location too

Add a `syncLocationToMemory` method with tag `LOCATION` and content like `"I am based in: {location}"`, matching the existing `/live in|based in|located|city/i` regex.

### Files changed

| File | Change |
|---|---|
| `src/hooks/useInterestSync.ts` | **New** — reusable bidirectional sync hook |
| `src/components/flows/weekly-event-finder/EventFinderConfig.tsx` | Use `useInterestSync`, add ref for previous values, call sync in `handleActivate` |

### What stays the same

- Edge function `weekly-event-finder` — no changes needed. The `prefill` action already reads from LIAM. Writes go through the existing `liam-memory` edge function.
- `useLiamMemory` hook — used as-is.
- `useWeeklyEventFinder` hook — unchanged.
- All other files — untouched.

### Why this approach

- **Reuses existing patterns**: `useLiamMemory.createMemory` already handles auth, signing, retries, and error toasts.
- **Separation of concerns**: Sync logic lives in its own hook, not embedded in the config component.
- **Reusable**: Any future flow that needs interest/location sync can import `useInterestSync`.
- **No redundant writes**: Diffs against prefilled values before saving.
- **Non-blocking**: Sync is fire-and-forget so it doesn't slow down activation.

