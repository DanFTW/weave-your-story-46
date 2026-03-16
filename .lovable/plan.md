

## Investigation Results

I invoked the edge function directly and checked the logs. The function successfully calls the Composio API (status 200) but extracts **0 tasks** from the response. The logs confirm:

```
[Todoist Poll] Composio response status: 200
[Todoist Poll] Found 0 total tasks
```

This means the Composio API returns data, but the task extraction logic doesn't match the actual response format.

### Root Cause

The current parsing checks these paths:
- `toolData.data.tasks`
- `toolData.data.response_data.tasks`
- `Array.isArray(toolData.data.response_data)`
- `Array.isArray(toolData.data)`
- `toolData.response_data.tasks`
- `Array.isArray(toolData.response_data)`

But the Composio v3 API typically returns data at `data.response_data.data` (as seen in the working Twitter automation poll). The Todoist REST API returns tasks as a plain array — not nested under a `.tasks` key — so the likely path is `toolData.data.response_data.data` which is **not checked**.

### Fix — `supabase/functions/todoist-automation-triggers/index.ts`

1. **Add diagnostic logging** of the raw response structure (`Object.keys` at each nesting level) so future issues are immediately visible in logs.

2. **Add the missing extraction path** `toolData.data.response_data.data` as the **first** check (matching the pattern used by working integrations like Twitter). Also add `toolData.data.data` as a fallback.

3. **Add a fallback log** that dumps the first 1000 chars of the raw response if no tasks are extracted, so we can diagnose any further format changes.

Updated extraction order:
```
rd = toolData.data?.response_data
1. Array.isArray(rd?.data)          ← NEW (primary Composio v3 format)
2. Array.isArray(rd)
3. rd?.tasks
4. toolData.data?.tasks
5. Array.isArray(toolData.data?.data) ← NEW
6. Array.isArray(toolData.data)
7. toolData.response_data?.tasks
8. Array.isArray(toolData.response_data)
9. Log raw response if nothing matched
```

No other files are modified.

