

## Investigation: Poll Action Not Returning Messages

### Findings

In `supabase/functions/slack-messages-sync/index.ts` (lines 180-183), the `conversations.history` call currently uses:
```typescript
const historyResult = await slackApi("conversations.history", {
  channel: channelId,
  limit: 20,
});
```

**Root cause:** The `limit` is only **20**, and there is no `oldest` parameter. Slack's `conversations.history` returns the most recent messages first. If those 20 messages were already processed (exist in `slack_processed_messages`), `totalImported` stays at 0 — appearing as "no new messages." On subsequent polls, this tiny window means only brand-new messages since the last poll would appear, and if the channel is quiet or messages have subtypes, nothing gets imported.

### Proposed Fix

1. **Add `oldest` parameter** — set to 30 days ago (as a Unix timestamp) so the initial sync window covers recent history.
2. **Increase `limit`** from 20 to 200 to capture more messages per poll.

**Change location:** Lines 180-183

```typescript
// 30 days ago as Unix timestamp
const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

const historyResult = await slackApi("conversations.history", {
  channel: channelId,
  limit: 200,
  oldest: String(thirtyDaysAgo),
});
```

No other code is touched. The deduplication logic via `slack_processed_messages` ensures already-imported messages are safely skipped.

