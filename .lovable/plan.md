

## Fix: COMPOSIO_SEARCH_EVENT 400 error

### Root Cause

The Composio v2 `/actions/.../execute` endpoint returns 400 with "App name and entity id must be present, if connected account id is not specified." The current request body only sends `{ input: { query } }` — it's missing the required `appName` and `entityId` fields.

### Change (single file)

**`supabase/functions/weekly-event-finder/index.ts`** — `searchEvents` function, line 96:

Change the request body from:
```typescript
const body = { input: { query: searchQuery } };
```
to:
```typescript
const body = {
  appName: "composio",
  entityId: "default",
  input: { query: searchQuery },
};
```

`appName: "composio"` identifies the COMPOSIO_SEARCH_EVENT tool's parent app. `entityId: "default"` is the standard Composio entity for tools that don't require user-level OAuth. No other changes needed.

### After deployment
- Redeploy the edge function
- Trigger "Find events now" and check logs to confirm a 200 response with event data

