

## Fix: COMPOSIO_SEARCH_EVENT "Tool not found" — wrong API endpoint

### Root Cause

The logs show `"Tool COMPOSIO_SEARCH_EVENT not found"` because the function calls `/api/v2/actions/COMPOSIO_SEARCH_EVENT/execute` — the **actions** endpoint. But `COMPOSIO_SEARCH_EVENT` is registered as a **tool** under the `COMPOSIO_SEARCH` toolkit. Every other Composio tool execution in the codebase (Gmail, Google Drive, Twitter, Spotify, Calendar, etc.) uses the **v3 tools** endpoint: `/api/v3/tools/execute/{TOOL_SLUG}`.

### Change (single file)

**`supabase/functions/weekly-event-finder/index.ts`** — `searchEvents` function:

1. Change the URL from:
   ```
   https://backend.composio.dev/api/v2/actions/COMPOSIO_SEARCH_EVENT/execute
   ```
   to:
   ```
   https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT
   ```

2. Update the request body to match the v3 tools format used everywhere else in the codebase:
   ```typescript
   const body = {
     connectedAccountId: undefined,  // not needed for Composio-native tools
     appName: "composio_search",
     entityId: "default",
     input: { query: searchQuery },
   };
   ```

No other changes — logging, extraction, curation, and delivery logic stay the same.

### Why this is correct

All 37 other edge functions in this project use `/api/v3/tools/execute/` for tool execution. The v2 actions endpoint is for a different class of Composio resources and does not resolve tool slugs like `COMPOSIO_SEARCH_EVENT`.

