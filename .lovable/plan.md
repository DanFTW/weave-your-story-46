

## Plan: Replace Sequential Loop with Promise.all for Full Concurrent Processing

### Change (single file: `supabase/functions/calendar-event-sync/index.ts`, lines 552-606)

Remove the `BATCH_LIMIT` and sequential `for` loop. Replace with `Promise.all` that processes **all** unprocessed memories concurrently. Each promise handles its own try/catch and DB writes, then returns a result object `{ created, queued, processed }` that gets aggregated after.

```typescript
// Remove lines 552-554 (BATCH_LIMIT, batch, log)
// Replace lines 556-606 (the for loop) with:

console.log(`[CalendarSync] Processing all ${unprocessed.length} unprocessed memories concurrently`);

const results = await Promise.all(
  unprocessed.map(async (mem) => {
    const result = { created: 0, queued: 0, processed: 0 };
    try {
      console.log(`[CalendarSync] Parsing memory ${mem.id}: "${mem.content.substring(0, 80)}..."`);
      const parsed = await parseMemoryForEvent(mem.content);
      console.log(`[CalendarSync] Parse result for ${mem.id}:`, JSON.stringify(parsed));
      result.processed++;

      if (!parsed.isEvent) return result;

      if (parsed.isComplete && parsed.title && parsed.date && integration?.composio_connection_id) {
        const ok = await createGCalEvent(/* same args */);
        if (ok) {
          await sb.from("pending_calendar_events").upsert({/* completed */});
          result.created++;
          return result;
        }
      }

      await sb.from("pending_calendar_events").upsert({/* pending */});
      result.queued++;
    } catch (err) {
      console.error(`[CalendarSync] Error processing memory ${mem.id}:`, err);
      result.processed++;
    }
    return result;
  })
);

// Aggregate
for (const r of results) {
  created += r.created;
  queued += r.queued;
  processed += r.processed;
}
```

The existing `AbortController` 10s timeout in `parseMemoryForEvent` stays untouched. No other files changed.

