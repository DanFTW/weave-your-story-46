

## Fix: Add "bill-due-reminder" to `flowEnabledThreads` in ThreadOverview

### Problem
The "Get Started" button on `/thread/bill-due-reminder` does nothing because `"bill-due-reminder"` is missing from the `flowEnabledThreads` array in `src/pages/ThreadOverview.tsx`.

### Fix: `src/pages/ThreadOverview.tsx`

**Line 36** — Append `'bill-due-reminder'` to the `flowEnabledThreads` array:

```typescript
const flowEnabledThreads = ['family', 'food-preferences', ..., 'weekly-event-finder', 'bill-due-reminder'];
```

### Files
- `src/pages/ThreadOverview.tsx` — one edit only

