

## Add Delete Button to Event Cards

### Overview
Add a delete button to each `FoundEventCard` that removes the event from the `weekly_event_finder_processed` table and updates the local state and count.

### Changes

**1. `src/hooks/useWeeklyEventFinder.ts`** — Add `deleteEvent` function
- Delete row from `weekly_event_finder_processed` by ID
- Remove from local `events` state
- Decrement `events_found` counter on the config row
- Update local `config.eventsFound` state

**2. `src/components/flows/weekly-event-finder/FoundEventCard.tsx`** — Add delete button
- Accept `onDelete: (id: string) => Promise<void>` prop
- Add a `Trash2` icon button in the expanded `CollapsibleContent` area (next to the "View event" link)
- Show loading state while deleting
- Style: muted destructive text button matching existing dismiss patterns (`text-sm text-destructive`)

**3. `src/components/flows/weekly-event-finder/ActiveMonitoring.tsx`** — Wire callback
- Accept `onDeleteEvent` prop, pass it through to each `FoundEventCard`

**4. `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx`** — Pass callback
- Pass `useWeeklyEventFinder.deleteEvent` to `ActiveMonitoring`

### Delete Flow
```text
User taps Trash icon → deleteEvent(id) called →
  1. DELETE from weekly_event_finder_processed WHERE id = ?
  2. UPDATE weekly_event_finder_config SET events_found = events_found - 1
  3. Remove event from local events[] state
  4. Decrement local config.eventsFound
  5. Toast: "Event removed"
```

No confirmation dialog needed — this is a lightweight dismiss action on non-critical data (matching the simple delete patterns used elsewhere in the app).

