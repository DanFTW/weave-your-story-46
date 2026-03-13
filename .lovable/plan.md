

## Analysis: Slack Poll → LIAM Memory Write

### Issue 1 (Critical): Shared LIAM keys instead of per-user keys

Every other edge function in the project (twitter-sync, facebook-page-posts, birthday-reminder, etc.) fetches LIAM credentials from the `user_api_keys` table per-user. But `slack-messages-sync` uses shared environment variables (`LIAM_API_KEY`, `LIAM_USER_KEY`, `LIAM_PRIVATE_KEY`).

This means all Slack memories are written to a single shared LIAM account, not the authenticated user's account. When a user lists their memories via the `liam-memory` edge function (which uses their per-user keys), Slack-imported memories won't appear.

### Issue 2: Author names are raw Slack user IDs

The poll action stores `msg.user` (e.g. `U08SNMXKW0V`) as the author name and writes it into the LIAM memory content as `"Slack message from U08SNMXKW0V: ..."`. The transfer prompt specifies resolving sender display names via `users.list`, but this isn't implemented.

### Fix (1 file)

**`supabase/functions/slack-messages-sync/index.ts`**

1. Replace shared env var LIAM key lookup with per-user lookup from `user_api_keys` table (matching every other edge function's pattern). Move the key fetch before the poll/search logic. Return a clear error if the user has no keys configured.

2. In the `poll` action, call `users.list` once before processing messages to build a `userId → displayName` map. Use this map when constructing `memoryContent` and `author_name`.

3. In the `search` action, also use per-user keys (already addressed by change 1).

No frontend changes needed. No other flows touched.

