

## Fix: Weekly Event Finder returning 0 events

### Root Cause

The slug `COMPOSIO_SEARCH_EVENT` is correct per the Composio dashboard. The current code already uses it. The issue is likely the **API version** (`/api/v3/actions/` may not route this tool correctly) and the **lack of logging** to see what Composio actually returns.

### Changes (single file)

**`supabase/functions/weekly-event-finder/index.ts`** — `searchEvents` function only:

1. **Add verbose logging** before and after the Composio call:
   - Log the full request URL and body
   - Log the response status code
   - Log the raw response body (truncated to 2000 chars)
   - Log each extraction path attempt and whether it yielded results

2. **Try the v2 endpoint as well**: Change from `/api/v3/actions/COMPOSIO_SEARCH_EVENT/execute` to `/api/v2/actions/COMPOSIO_SEARCH_EVENT/execute` — the v2 actions endpoint is the standard one for tool execution without a connected account

3. **Broaden response extraction**: Add more extraction paths to handle various Composio response shapes:
   - `data.response_data.events_results`
   - `data.response_data.results`
   - `data.response_data` (if it's an array itself)
   - Keep existing paths as fallbacks

4. **Remove `limit` param**: `COMPOSIO_SEARCH_EVENT` may not accept `limit` — pass only `query` to avoid rejected/ignored params

### What stays the same
- Tool slug: `COMPOSIO_SEARCH_EVENT` (confirmed correct)
- LLM curation, email delivery, all frontend code — unchanged

### After deployment
- Redeploy the edge function
- Trigger "Find events now" and check edge function logs to see the actual Composio response shape
- If events are returned in an unexpected structure, the logs will reveal it for a quick follow-up fix

