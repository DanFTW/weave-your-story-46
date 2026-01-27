
# Fix Trello Board Fetching - 405 Error Resolution

## Problem Summary

The Trello Task Tracker fails to fetch boards with a **405 Method Not Allowed** error from the Composio API.

| Symptom | Cause |
|---------|-------|
| "No boards found" + error toast | Wrong API URL path structure |
| 405 error in logs | The endpoint `/actions/{slug}/execute` doesn't exist |

## Root Cause

The edge function uses an incorrect Composio API URL:

```text
WRONG:   /api/v3/actions/TRELLO_GET_BOARDS/execute
CORRECT: /api/v3/tools/execute/TRELLO_GET_BOARDS
                 ↑          ↑
            "tools" first, then "execute", then slug
```

Additionally, the request body uses `input` instead of `arguments` for parameters.

## Solution

Update `supabase/functions/trello-automation-triggers/index.ts`:

1. Change the API base constant or inline URLs to use `/tools/execute/{SLUG}` pattern
2. Change request body from `input` to `arguments` for action parameters
3. Match the proven pattern used in other working edge functions

---

## Technical Changes

### File: `supabase/functions/trello-automation-triggers/index.ts`

**Change 1: Fix get-boards URL (line ~82)**

Before:
```typescript
const response = await fetch(`${COMPOSIO_API_BASE}/actions/TRELLO_GET_BOARDS/execute`, {
```

After:
```typescript
const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS", {
```

**Change 2: Fix get-lists URL (line ~123)**

Before:
```typescript
const response = await fetch(`${COMPOSIO_API_BASE}/actions/TRELLO_GET_LISTS_BY_ID_BOARD/execute`, {
```

After:
```typescript
const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_LISTS_BY_ID_BOARD", {
```

**Change 3: Fix get-lists request body (line ~129-131)**

Before:
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  input: { idBoard: boardId },
}),
```

After:
```typescript
body: JSON.stringify({
  connected_account_id: connectionId,
  arguments: { idBoard: boardId },
}),
```

---

## Expected Response Structure

Based on other working integrations, the response format is:

```typescript
{
  data: {
    // or response_data containing the actual array
    response_data: [
      { id: "board1", name: "My Board", url: "https://..." },
      // ...
    ]
  }
}
```

The existing parsing logic already handles this structure:
```typescript
const boards = data?.data?.response_data || data?.data || [];
```

---

## Files to Change

| File | Changes |
|------|---------|
| `supabase/functions/trello-automation-triggers/index.ts` | Fix API URLs from `/actions/{slug}/execute` to `/tools/execute/{slug}`, change `input` to `arguments` |

---

## Verification

After deployment, the expected flow:

1. User navigates to `/flow/trello-tracker`
2. Edge function calls correct Composio URL
3. API returns 200 with user's boards
4. BoardPicker displays all boards (regardless of visibility setting)
