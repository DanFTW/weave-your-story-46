

## Root Cause

The edge function finds 25 raw memories from LIAM, but **all are filtered out** before processing. The logs confirm:

```
Found 25 raw memories
Processing all 0 unprocessed memories concurrently
```

`pending_calendar_events` table is empty, so the "already processed" filter isn't the culprit. The real problem is on **line 527** of `calendar-event-sync/index.ts`:

```typescript
.map((m: any) => ({ id: m.transactionNumber || m.id || ..., content: m.content }))
.filter((m: any) => m.content);
```

The LIAM API returns memory text in the field **`memory`**, not `content`. This is confirmed by `useLiamMemory.ts` line 282:

```typescript
content: m.memory || m.content || '',
```

Since `m.content` is `undefined` for every LIAM record, every mapped object has `content: undefined`, and the `.filter((m: any) => m.content)` removes all 25 memories, leaving 0 to process.

## Fix

**File:** `supabase/functions/calendar-event-sync/index.ts`, line 527

Change the content mapping from:
```typescript
content: m.content
```
to:
```typescript
content: m.memory || m.content || ''
```

This matches the pattern already used in `useLiamMemory.ts`. One-line change, then redeploy.

