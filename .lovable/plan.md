

## Root Cause

The logs are definitive. The Composio tool `TODOIST_GET_ALL_TASKS` is internally calling Todoist's **deprecated v8 API endpoint**, which returns a `410 Gone`:

```
Error fetching tasks: 410 - This endpoint is deprecated.
If you're reading this on a browser, there's a good chance you can change
the v8 part on the URL to v1 and get away with it. ;)
```

This is a Composio-side bug — their tool implementation hasn't been updated to use the current Todoist REST API. The HTTP 200 from Composio is misleading; the inner `successful: false` and `status_code: 410` confirm the upstream failure.

## Fix Strategy

Replace the `TODOIST_GET_ALL_TASKS` Composio tool execution with a **direct Todoist REST API v2 call**, extracting the OAuth access token from the Composio connected account metadata. This is the same proven pattern used by HubSpot, LinkedIn, Discord, and Fireflies integrations in this codebase.

## Changes — `supabase/functions/todoist-automation-triggers/index.ts`

### 1. Add `getTodoistAccessToken()` helper

Extract the OAuth token from the Composio connected account metadata at `GET /api/v3/connected_accounts/{connectionId}`, checking multiple paths (`data.connection_params.access_token`, `data.access_token`, etc.) — identical to the HubSpot/LinkedIn pattern.

### 2. Replace `pollTodoistTasks` internals

Instead of calling `POST /api/v3/tools/execute/TODOIST_GET_ALL_TASKS`, call Todoist's REST API directly:

```
GET https://api.todoist.com/rest/v2/tasks
Authorization: Bearer {accessToken}
```

This returns a plain JSON array of task objects. No response-format guessing needed — the array IS the response body.

### 3. Remove all Composio response-format extraction logic

The current 8-path extraction cascade (`rd?.data`, `Array.isArray(rd)`, `rd?.tasks`, etc.) becomes unnecessary since the Todoist API returns a clean array directly.

### 4. Keep everything else unchanged

Memory creation, deduplication, stats tracking, and all other actions (activate, deactivate) remain the same. Only the task-fetching mechanism changes.

No other files are modified.

