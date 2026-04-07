

## Fix: Location not filtering event search results

### Problem

The `searchEventsSingle` function builds the search query as `"${interest} events"` (e.g., `"tech events"`) and passes `location` as a separate argument. The Composio `COMPOSIO_SEARCH_EVENT_SEARCH` tool is not reliably using the `location` parameter to geo-filter results, so events from random cities are returned.

### Solution

Include the location directly in the search query string so it becomes part of the actual search terms. Change:

```typescript
const searchQuery = `${interest.trim()} events`;
```

To:

```typescript
const searchQuery = `${interest.trim()} events in ${location.trim()}`;
```

This ensures the location is part of the search engine query itself, which is the most reliable way to get geo-relevant results from a web search tool.

### File

`supabase/functions/weekly-event-finder/index.ts` — line 93

### Post-change

Redeploy the `weekly-event-finder` edge function.

