

## Plan: "Event Memory to Google Calendar" Thread

### Overview
Create a thread that monitors newly saved memories for event/date references, and when the user enables it via a toggle (with Google Calendar connected), automatically creates Google Calendar events. Memories with incomplete event info sit in an editable queue.

### Architecture

```text
Memory saved to LIAM
        │
        ▼
 Edge Function: calendar-event-sync
   ├─ parse memory content for event signals
   ├─ if complete (title + date) → create GCal event via Composio
   └─ if incomplete → store in pending_calendar_events table
        │
        ▼
  UI: /flow/calendar-event-sync
   ├─ Auth gate (useComposio GOOGLECALENDAR)
   ├─ Toggle to enable/disable auto-sync
   ├─ Pending queue of incomplete events
   └─ Tap to fill in missing fields → push to GCal
```

### Database

**Table: `calendar_event_sync_config`**
```sql
create table public.calendar_event_sync_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  is_active boolean not null default false,
  events_created integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);
alter table public.calendar_event_sync_config enable row level security;
-- Standard user-owns-own RLS for SELECT, INSERT, UPDATE
```

**Table: `pending_calendar_events`**
```sql
create table public.pending_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  memory_id text not null,
  memory_content text not null,
  event_title text,
  event_date text,
  event_time text,
  event_description text,
  status text not null default 'pending', -- 'pending' | 'completed' | 'dismissed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, memory_id)
);
alter table public.pending_calendar_events enable row level security;
-- Standard user-owns-own RLS for SELECT, INSERT, UPDATE, DELETE
```

### Edge Function: `calendar-event-sync`

Single edge function handling these actions:

- **`activate` / `deactivate`**: Toggle `is_active` in config table
- **`status`**: Return config + pending events
- **`parse-memory`**: Accepts a memory content string. Uses AI (Lovable API) to extract event title, date, time, description. Returns parsed fields + completeness flag.
- **`create-event`**: Takes event details, calls Composio `GOOGLECALENDAR_CREATE_EVENT` action using the user's connected account. Records in `pending_calendar_events` as `completed`.
- **`process-new-memory`**: Called as a side-effect after memory creation. Parses the memory, if complete + auto-sync enabled → creates event immediately. If incomplete → inserts into pending queue.
- **`update-pending`**: Updates a pending event's fields
- **`dismiss-pending`**: Marks a pending event as dismissed

### Frontend Files

**1. `src/types/calendarEventSync.ts`** — Type definitions for config, pending events, phases

**2. `src/hooks/useCalendarEventSync.ts`** — Hook managing:
- Phase state (`auth-check` → `configure` → `active`)
- `loadConfig()` — fetches config + pending events
- `activate()` / `deactivate()` — toggle auto-sync
- `updatePendingEvent()` — update fields on a pending event
- `pushToCalendar()` — send a completed pending event to GCal
- `dismissPending()` — remove from queue

**3. `src/components/flows/calendar-event-sync/`**:
- `CalendarEventSyncFlow.tsx` — Main flow component with auth gate (useComposio GOOGLECALENDAR), header, phase routing
- `AutomationConfig.tsx` — Toggle card explaining the feature + activate button
- `ActiveMonitoring.tsx` — Shows toggle (on/off), stats, and the pending queue below
- `PendingEventCard.tsx` — Expandable card for each incomplete event showing parsed fields, editable inputs, and a "Push to Calendar" button
- `index.ts` — barrel export

**4. Modify existing files:**

- **`src/types/flows.ts`** — Add `isCalendarEventSyncFlow?: boolean`
- **`src/data/flowConfigs.ts`** — Add `"calendar-event-sync"` entry with `isCalendarEventSyncFlow: true`
- **`src/data/threadConfigs.ts`** — Add `"calendar-event-sync"` thread config with steps (Connect Google Calendar → Enable → Active)
- **`src/data/threads.ts`** — Add thread entry `{ id: "calendar-event-sync", title: "Event Memory to Google Calendar", ... flowMode: "thread" }`
- **`src/pages/Threads.tsx`** — Add `"calendar-event-sync"` to `flowEnabledThreads`
- **`src/pages/ThreadOverview.tsx`** — Add `"calendar-event-sync"` to `flowEnabledThreads`
- **`src/pages/FlowPage.tsx`** — Import `CalendarEventSyncFlow`, add `if (config.isCalendarEventSyncFlow)` render block

### Memory Creation Side-Effect

The key integration point: after a memory is successfully created via `useLiamMemory.createMemory()`, we add a lightweight side-effect. Rather than modifying `useLiamMemory` directly (which would couple it), we create a **new hook `useCalendarEventSideEffect`** that:

1. Exposes a `processMemoryForCalendar(content: string, memoryId: string)` function
2. Checks if user has calendar sync enabled (reads from config table)  
3. If enabled, invokes the `calendar-event-sync` edge function with action `process-new-memory`
4. The edge function uses AI to parse event data, then either creates the GCal event or queues it

This hook is called from `FlowPage` and other memory-creation points as a fire-and-forget side effect — it does not block or modify the existing memory save flow.

However, to keep changes minimal, we'll integrate this side-effect into the `calendar-event-sync` edge function's `process-new-memory` action and call it from the frontend after successful `createMemory` calls in the key flows (QuickMemoryDrawer, FlowPage confirm). We add a single utility function `triggerCalendarSync(content, memoryId)` that checks config and invokes the edge function.

### Event Parsing (AI)

The edge function's `parse-memory` action sends the memory content to the Lovable API with a prompt like:

> "Extract event information from this text. Return JSON: { title, date (ISO), time (HH:mm or null), description, isComplete: boolean }. If no event is detected, return { isEvent: false }."

### Composio Integration

Uses `GOOGLECALENDAR_CREATE_EVENT` action via Composio API, same pattern as birthday reminder's `GMAIL_CREATE_EMAIL_DRAFT`. Fetches the user's connected account ID from `user_integrations` where `integration_id = 'googlecalendar'`.

### Summary of all file changes

| File | Change |
|------|--------|
| `src/types/calendarEventSync.ts` | New — types |
| `src/hooks/useCalendarEventSync.ts` | New — hook |
| `src/utils/triggerCalendarSync.ts` | New — fire-and-forget side-effect util |
| `src/components/flows/calendar-event-sync/*.tsx` | New — 5 files |
| `supabase/functions/calendar-event-sync/index.ts` | New — edge function |
| `src/types/flows.ts` | Add `isCalendarEventSyncFlow` flag |
| `src/data/flowConfigs.ts` | Add config entry |
| `src/data/threadConfigs.ts` | Add thread config |
| `src/data/threads.ts` | Add thread entry |
| `src/pages/Threads.tsx` | Add to flowEnabledThreads |
| `src/pages/ThreadOverview.tsx` | Add to flowEnabledThreads |
| `src/pages/FlowPage.tsx` | Add import + render block |
| `supabase/config.toml` | Add function config |
| Migration SQL | Create 2 tables with RLS |

