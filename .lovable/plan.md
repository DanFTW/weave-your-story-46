

## Fix: Event extraction path and location parameter

### Problem

From the logs, the actual Composio response structure is:
```json
{
  "data": {
    "results": {
      "events_results": [{ "title": "...", ... }]
    }
  },
  "successful": true
}
```

But the extraction candidates list checks `data.response_data.events_results`, `data.response_data.results`, etc. — it never checks `data.results.events_results`, which is where the events actually live. That's why events are visible in the raw log but extraction returns nothing.

Additionally, the COMPOSIO_SEARCH_EVENT_SEARCH tool accepts a separate `location` parameter in `arguments`, so we should pass it there instead of appending to the query string.

### Changes — `supabase/functions/weekly-event-finder/index.ts`

**1. Pass location as a separate argument** (lines 93-100):
```typescript
async function searchEventsSingle(interest: string, location: string): Promise<any[]> {
  const searchQuery = `${interest.trim()} events`;
  const url = "https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT_SEARCH";
  const body = {
    appName: "composio_search",
    entity_id: "default",
    arguments: { query: searchQuery, location: location.trim() },
  };
```

**2. Add the correct extraction path** to the candidates array (line 130). Add `data.results.events_results` as the first candidate since that's the confirmed structure:
```typescript
const candidates = [
  data?.data?.results?.events_results,   // ← actual path from logs
  data?.data?.response_data?.events_results,
  data?.data?.response_data?.results,
  // ... rest unchanged
];
```

**3. Redeploy** the edge function.

