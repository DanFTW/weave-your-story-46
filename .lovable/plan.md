

## Filter out past events from Weekly Event Finder results

### Problem

The event finder returns events with dates that have already passed. There is no date filtering anywhere in the pipeline — raw results and curated results both pass through without checking whether the event date is in the future.

### Solution

Add a utility function `isUpcomingEvent` that attempts to parse the date field from an event and returns `true` only if the date is today or in the future. Apply this filter at two points:

1. **Before LLM curation** — filter raw search results so the LLM only sees upcoming events
2. **After LLM curation** — filter curated results as a safety net (the LLM may hallucinate or return stale dates)

### Changes

**File: `supabase/functions/weekly-event-finder/index.ts`**

**1. Add `isUpcomingEvent` helper (after the existing utility functions, ~line 182)**

A function that extracts the date string from an event (checking `date`, `start_date`, `when`), attempts to parse it, and returns `true` if it's today or later. Events with unparseable dates are kept (benefit of the doubt).

```typescript
function isUpcomingEvent(event: any): boolean {
  const dateStr = event.date || event.start_date || event.when || "";
  if (!dateStr) return true; // keep events with no date info
  try {
    const eventDate = new Date(dateStr);
    if (isNaN(eventDate.getTime())) return true; // unparseable, keep it
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  } catch {
    return true;
  }
}
```

**2. Filter raw results before curation (~line 443)**

After `searchEvents` returns, filter out past events before passing to the LLM:

```typescript
const rawEvents = await searchEvents(interests, location);
const upcomingRaw = rawEvents.filter(isUpcomingEvent);
console.log(`Found ${rawEvents.length} raw events, ${upcomingRaw.length} upcoming`);
```

**3. Filter curated results after curation (~line 448)**

```typescript
const curated = await curateEvents(upcomingRaw, interests);
const upcomingCurated = curated.filter(isUpcomingEvent);
console.log(`Curated to ${curated.length} events, ${upcomingCurated.length} upcoming`);
```

Then use `upcomingCurated` in place of `curated` for the rest of the sync logic.

**4. Redeploy the edge function.**

### Design notes

- Events with missing or unparseable dates are kept rather than dropped — avoids losing valid events that use non-standard date formats
- Filtering at both pre- and post-curation stages ensures robustness
- No other files or logic are changed

