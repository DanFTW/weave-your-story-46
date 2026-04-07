

## Fix: COMPOSIO_SEARCH_EVENT 400 "Validation error" — wrong request body format

### Root Cause

The Composio v3 `/api/v3/tools/execute/` endpoint expects `arguments` for tool parameters, not `input`. Every other Composio tool call in the codebase (28 functions) uses this format:

```typescript
{ connected_account_id: "...", arguments: { ... } }
```

The current weekly-event-finder sends `{ appName, entityId, input }` which the endpoint doesn't recognize, causing `"Only one of 'text' or 'arguments' must be provided"`.

Since `COMPOSIO_SEARCH_EVENT` doesn't require user OAuth, we use `entity_id` with `"default"` instead of `connected_account_id`.

### Change (single file)

**`supabase/functions/weekly-event-finder/index.ts`** — `searchEvents` function, lines 96-100:

Change the request body from:
```typescript
const body = {
  appName: "composio_search",
  entityId: "default",
  input: { query: searchQuery },
};
```
to:
```typescript
const body = {
  entity_id: "default",
  arguments: { query: searchQuery },
};
```

This matches the v3 tools endpoint contract used by all other edge functions. `entity_id` tells Composio to resolve the tool without a specific connected account. `arguments` is the correct key for passing tool parameters.

### After deployment
- Redeploy the edge function
- Trigger "Find events now" and check logs for a 200 response

