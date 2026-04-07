

## Fix Composio tool slug in weekly-event-finder

### Change

**`supabase/functions/weekly-event-finder/index.ts`** — Line 95

Replace `COMPOSIO_SEARCH_EVENT` with `COMPOSIO_SEARCH_EVENT_SEARCH` in the URL:

```typescript
// Before
const url = "https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT";
// After
const url = "https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT_SEARCH";
```

This is the only reference to this slug in the file. The `GMAIL_SEND_EMAIL` slug is unaffected.

Then redeploy the edge function.

