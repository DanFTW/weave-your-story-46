

## Analysis: Why Messages Aren't Being Synced

**Root Cause:** The `poll` action uses the shared `SLACK_USER_TOKEN` instead of the per-user OAuth token. The shared token belongs to a different Slack workspace than the one the user connected, so `conversations.history` returns `channel_not_found` (visible in the edge function logs).

Line 128-129 of the edge function only routes `list-workspace` and `list-channels` to the per-user token:
```typescript
const usePerUserToken = action === "list-workspace" || action === "list-channels";
```

The `poll` and `search` actions fall through to the shared `SLACK_USER_TOKEN`, which doesn't have access to the channels the user selected from their own workspace.

**Fix (1 file):**

**`supabase/functions/slack-messages-sync/index.ts`** -- Change `usePerUserToken` to also include `poll` and `search` actions, so all actions that need channel access use the user's own token (falling back to shared if unavailable):

```typescript
const usePerUserToken = action === "list-workspace" || action === "list-channels" || action === "poll" || action === "search";
```

This single-line change ensures the poll/search actions use the token that actually has access to the user's selected channels.

