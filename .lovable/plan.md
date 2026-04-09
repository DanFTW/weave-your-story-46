

## Add Event List to Active Monitoring

### Problem
The active monitoring page only shows an event count. Users have no way to see what events were actually found.

### Approach
1. **Expand the database** — add columns to `weekly_event_finder_processed` for `event_date`, `event_description`, `event_reason`, and `event_link` so event details persist.
2. **Store full event data** — update the edge function's `manual-sync` to write these fields when recording processed events.
3. **Fetch events client-side** — add a `loadEvents` function in the hook that queries `weekly_event_finder_processed` directly via Supabase client, ordered by `processed_at desc`.
4. **Build an expandable event card** — new `FoundEventCard` component following the same expand/collapse pattern as `PendingEventCard` (chevron toggle, `bg-card rounded-2xl border` styling).
5. **Render the list in `ActiveMonitoring`** — replace the static count card with a section showing the count header and a list of `FoundEventCard` items.

### Files

| File | Change |
|---|---|
| `supabase/migrations/new.sql` | `ALTER TABLE` to add `event_date`, `event_description`, `event_reason`, `event_link` columns |
| `supabase/functions/weekly-event-finder/index.ts` | Store the new fields in the `upsert` call when recording processed events |
| `src/types/weeklyEventFinder.ts` | Add `FoundEvent` interface |
| `src/hooks/useWeeklyEventFinder.ts` | Add `events` state + `loadEvents` query from `weekly_event_finder_processed`; call it on load and after sync |
| `src/components/flows/weekly-event-finder/FoundEventCard.tsx` | New expandable card component (title + date collapsed; description, reason, link expanded) |
| `src/components/flows/weekly-event-finder/ActiveMonitoring.tsx` | Accept `events` prop, render list of `FoundEventCard` below the stats section |
| `src/components/flows/weekly-event-finder/WeeklyEventFinderFlow.tsx` | Pass `events` from hook to `ActiveMonitoring` |

### New type

```typescript
export interface FoundEvent {
  id: string;
  eventTitle: string;
  eventDate: string | null;
  eventDescription: string | null;
  eventReason: string | null;
  eventLink: string | null;
  processedAt: string;
}
```

### FoundEventCard design
- Collapsed: title (bold, truncated) + date on right, chevron indicator
- Expanded: description paragraph, "Why this matches" reason in muted text, link as tappable anchor
- Uses `bg-card rounded-2xl border border-border` card pattern
- ChevronDown/ChevronUp toggle, consistent with `PendingEventCard`

### Edge function upsert change
```typescript
await sb.from("weekly_event_finder_processed").upsert(
  {
    user_id: userId,
    event_id: eventId,
    event_title: e.title || e.name || "",
    event_date: extractDateString(e.when) || extractDateString(e.date) || null,
    event_description: e.description || null,
    event_reason: e.reason || null,
    event_link: e.link || null,
  },
  { onConflict: "user_id,event_id" }
);
```

### Migration
```sql
ALTER TABLE public.weekly_event_finder_processed
  ADD COLUMN event_date text,
  ADD COLUMN event_description text,
  ADD COLUMN event_reason text,
  ADD COLUMN event_link text;
```

