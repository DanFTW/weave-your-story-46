

## Fix: Composio API URL path format in weekly-event-finder

### Problem
Two Composio calls in `supabase/functions/weekly-event-finder/index.ts` use the wrong URL path format:
- Line 95: `https://backend.composio.dev/api/v3/actions/COMPOSIO_SEARCH_EVENT/execute`
- Line 224: `https://backend.composio.dev/api/v3/actions/GMAIL_SEND_EMAIL/execute`

The correct v3 format puts the tool slug **after** `/execute/`:
```
/api/v3/tools/execute/{TOOL_SLUG}
```

### Changes (single file)

**`supabase/functions/weekly-event-finder/index.ts`**

1. **Line 95** — Fix `searchEvents` URL:
   ```typescript
   // Before
   const url = "https://backend.composio.dev/api/v3/actions/COMPOSIO_SEARCH_EVENT/execute";
   // After
   const url = "https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT";
   ```

2. **Line 224** — Fix `sendEmail` URL:
   ```typescript
   // Before
   const res = await fetch("https://backend.composio.dev/api/v3/actions/GMAIL_SEND_EMAIL/execute", {
   // After
   const res = await fetch("https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL", {
   ```

Then redeploy the edge function.

