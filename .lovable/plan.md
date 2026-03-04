

## Plan: Fix Manual Sync Not Detecting Events

### Root Cause

The edge function logs show it successfully finds 25 raw memories but then immediately shuts down with no further output — no parse results, no errors, no completion message. This is a **timeout issue**: the function tries to call the AI gateway (`parseMemoryForEvent`) for all 25 unprocessed memories sequentially, which exceeds the edge function's execution time limit (typically ~25s for Supabase).

Additionally, there's no logging between finding memories and processing them, so failures are silent.

### Fix (single file: `supabase/functions/calendar-event-sync/index.ts`)

1. **Limit batch size to 5 memories per sync** — Process at most 5 unprocessed memories per manual-sync invocation instead of all 25+. This keeps execution well within the timeout window.

2. **Add diagnostic logging** — Log each memory being parsed and each AI response so we can trace exactly what happens.

3. **Add try/catch around each memory's processing** — If one memory's AI call fails/times out, skip it and continue to the next rather than crashing the whole function.

4. **Add AI timeout** — Use `AbortController` with a 10-second timeout on the AI fetch call so a single slow response doesn't kill the whole function.

### Specific Changes

In the `manual-sync` action block:

```typescript
// Before the processing loop:
const BATCH_LIMIT = 5;
const batch = unprocessed.slice(0, BATCH_LIMIT);
console.log(`[CalendarSync] Processing ${batch.length} of ${unprocessed.length} unprocessed memories`);

for (const mem of batch) {
  try {
    console.log(`[CalendarSync] Parsing memory ${mem.id}: "${mem.content.substring(0, 80)}..."`);
    const parsed = await parseMemoryForEvent(mem.content);
    console.log(`[CalendarSync] Parse result for ${mem.id}:`, JSON.stringify(parsed));
    processed++;
    // ... rest of logic unchanged
  } catch (err) {
    console.error(`[CalendarSync] Error processing memory ${mem.id}:`, err);
    processed++;
    continue;
  }
}
```

In `parseMemoryForEvent`:
- Add `AbortController` with 10s timeout on the AI fetch
- Add logging of the AI response status

No other files changed.

