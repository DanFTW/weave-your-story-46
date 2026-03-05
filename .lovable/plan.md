

## Fix Timestamp Format in Google Sheet

**Problem**: The date posted to Google Sheets includes milliseconds and a `Z` suffix (e.g., `2026-03-05T00:26:32.557Z`). User wants the cleaner format: `2026-03-04T15:30:00`.

**Fix**: In `supabase/functions/grocery-sheet-sync/index.ts` line 146, replace `new Date().toISOString()` with a formatted version that strips milliseconds and the trailing `Z`:

```typescript
new Date().toISOString().replace(/\.\d{3}Z$/, '')
```

This converts `2026-03-05T00:26:32.557Z` to `2026-03-05T00:26:32`.

Then redeploy the edge function.

