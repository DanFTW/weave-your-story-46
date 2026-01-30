
# Fix Trello Board Loading with Correct Composio Tool Names

## Problem Summary

The Trello Task Tracker fails to load boards because the edge function uses incorrect Composio tool names:

| Current (Wrong) | Correct (From Composio Docs) |
|-----------------|------------------------------|
| `TRELLO_GET_BOARDS` | `TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER` |
| `TRELLO_GET_LISTS_BY_ID_BOARD` | `TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD` |

The Composio API returns a 404 with `{"error":{"message":"Tool TRELLO_GET_BOARDS not found"}}` because the tool slug doesn't exist.

---

## Solution

### 1. Update Edge Function Tool Names

**File:** `supabase/functions/trello-automation-triggers/index.ts`

**`get-boards` action (lines 95-145):**
- Change endpoint from `TRELLO_GET_BOARDS` to `TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER`
- Add required `idMember: "me"` parameter to get the authenticated user's boards

```typescript
// BEFORE
const response = await fetch(
  "https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS",
  {
    // ...
    body: JSON.stringify({
      connected_account_id: connectionId,
      arguments: {},
    }),
  }
);

// AFTER
const response = await fetch(
  "https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER",
  {
    // ...
    body: JSON.stringify({
      connected_account_id: connectionId,
      arguments: { idMember: "me" },  // "me" = authenticated user
    }),
  }
);
```

**`get-lists` action (lines 147-204):**
- Change endpoint from `TRELLO_GET_LISTS_BY_ID_BOARD` to `TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD`
- Keep `idBoard` parameter as-is

```typescript
// BEFORE
const response = await fetch(
  "https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_LISTS_BY_ID_BOARD",
  // ...
);

// AFTER
const response = await fetch(
  "https://backend.composio.dev/api/v3/tools/execute/TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD",
  // ...
);
```

### 2. Fix Error Handling for Complex Error Objects

**File:** `supabase/functions/trello-automation-triggers/index.ts`

Update the error parsing logic to handle deeply nested Composio error objects:

```typescript
// BEFORE
let errorDetails = "Unknown error";
try {
  const parsed = JSON.parse(errorText);
  errorDetails = parsed.message || parsed.error || parsed.details || errorText;
} catch {}

// AFTER
let errorDetails = "Unknown error";
try {
  const parsed = JSON.parse(errorText);
  // Handle nested error structure: {"error": {"message": "..."}}
  if (parsed.error && typeof parsed.error === 'object') {
    errorDetails = parsed.error.message || parsed.error.suggested_fix || JSON.stringify(parsed.error);
  } else {
    errorDetails = parsed.message || parsed.error || parsed.details || errorText;
  }
} catch {
  errorDetails = errorText || `HTTP ${response.status}`;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/trello-automation-triggers/index.ts` | Fix tool names, add `idMember` parameter, improve error parsing |

---

## Technical Details

### Composio Tool Naming Convention

Composio uses a specific naming pattern for Trello tools:
- `TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER` - Get boards for a member (use `idMember: "me"`)
- `TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD` - Get lists on a board (use `idBoard: "<board_id>"`)

### Response Structure

Both tools return data in `data.response_data` or directly in `data`:
```json
{
  "data": {
    "response_data": [
      { "id": "...", "name": "My Board", "url": "..." }
    ]
  }
}
```

The existing response parsing logic already handles this structure correctly.

---

## Expected Outcome

After implementation:
1. Boards load successfully in the board picker UI
2. Lists load successfully after selecting a board
3. Error messages display the actual Composio error (e.g., "Token expired") instead of "Tool not found"
4. No React runtime errors from rendering objects as children
