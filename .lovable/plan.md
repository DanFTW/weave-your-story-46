

## Plan: Add Manual Sync Button to Calendar Event Sync

### What
Add a "Sync now" button to the `ActiveMonitoring` component that triggers a manual scan of existing memories for event data. This calls the edge function with a new `manual-sync` action that fetches recent LIAM memories and processes them for calendar events.

### Changes

**1. `supabase/functions/calendar-event-sync/index.ts`** — Add `manual-sync` action
- Fetches the user's recent memories from LIAM API (last 50 or configurable)
- For each memory, checks if it already exists in `pending_calendar_events`
- Skips already-processed memories
- Runs `parseMemoryForEvent` on unprocessed ones
- Creates GCal events for complete results, queues incomplete ones
- Returns a summary count `{ processed, created, queued }`

**2. `src/hooks/useCalendarEventSync.ts`** — Add `manualSync` function + `isSyncing` state
- New `manualSync` callback that invokes the edge function with `action: "manual-sync"`
- Adds `isSyncing` boolean state
- After sync completes, calls `loadConfig()` to refresh pending events and stats
- Expose `manualSync` and `isSyncing` in the return

**3. `src/components/flows/calendar-event-sync/ActiveMonitoring.tsx`** — Add sync button
- Add `onManualSync` and `isSyncing` props
- Render a "Sync now" button (with `RefreshCw` icon) between the stats card and the pending queue
- Button shows a spinner while syncing, disabled during sync
- Styled as a secondary action card matching the existing design

**4. `src/components/flows/calendar-event-sync/CalendarEventSyncFlow.tsx`** — Wire the new prop
- Pass `manualSync` and `isSyncing` to `ActiveMonitoring`

