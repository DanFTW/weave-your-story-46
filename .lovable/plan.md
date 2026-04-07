
Goal: fix the Composio request contract in `supabase/functions/weekly-event-finder/index.ts` only.

What I found
- The URL path is already correct in this file: `/api/v3/tools/execute/{TOOL_SLUG}`.
- The failing `COMPOSIO_SEARCH_EVENT` call is using the right path, but the wrong body for this specific no-auth tool. Based on the project’s Composio integration notes, this tool needs:
  - `appName: "composio_search"`
  - `entity_id: "default"`
  - `arguments: { ... }`
- Right now `searchEvents()` is missing `appName`, which explains the 404 “Tool COMPOSIO_SEARCH_EVENT not found” even though the tool exists.
- The `GMAIL_SEND_EMAIL` call in the same file also uses a non-standard payload shape:
  - `connectedAccountId`
  - `authConfig`
  - `input`
  Working Composio calls elsewhere in the repo consistently use snake_case top-level fields like:
  - `connected_account_id`
  - optional `auth_config_id`
  - `arguments`

Implementation
1. Update `searchEvents()` to use the correct unauthenticated Composio v3 body:
```ts
const body = {
  appName: "composio_search",
  entity_id: "default",
  arguments: { query: searchQuery },
};
```

2. Update `sendEmail()` to use the same v3 execution style used by the rest of the codebase:
```ts
body: JSON.stringify({
  connected_account_id: connId,
  auth_config_id: "ac_IlbziSKZknmH",
  arguments: {
    recipient_email: to,
    subject,
    message_body: body,
  },
})
```

3. Keep both URLs on the existing correct path:
```ts
https://backend.composio.dev/api/v3/tools/execute/COMPOSIO_SEARCH_EVENT
https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL
```

4. Make no other changes to curation, deduping, config updates, or delivery logic.

Technical details
- `COMPOSIO_SEARCH_EVENT` is the only no-auth Composio call in this file, so it needs tool-resolution metadata (`appName`) instead of a connected account.
- `GMAIL_SEND_EMAIL` is a connected-account tool and should match the project’s established execution contract.
- There are only 2 Composio executions in this file, so the full fix is contained to one file.

Verification
- Redeploy `weekly-event-finder`.
- Run “Find events now”.
- Confirm logs no longer show `Tool COMPOSIO_SEARCH_EVENT not found`.
- If email delivery is triggered, confirm the Gmail call no longer fails due to request-shape issues.
