

## Investigation Results

**Logs**: The edge function successfully fetches 15 messages from channel `C0AL5MFQVJR` on every poll. No errors logged.

**Database**: 12 rows exist in `slack_processed_messages` — all with `message_content: NULL` and `author_name: NULL`. These were inserted by the old function version before the columns were added.

**Root cause**: All 12 non-subtype messages are already in the dedup table (the remaining 3 have subtypes and are skipped). The dedup check finds them, so `totalImported = 0` and the toast shows "No new messages found." The function is working as designed — there genuinely are no new messages. But the existing rows have null content because they were created before the schema migration.

## Fix

**Add a backfill step** to the `poll` action in `supabase/functions/slack-messages-sync/index.ts`. After the main import loop for each channel, iterate over the fetched messages and update any existing `slack_processed_messages` rows that have `message_content IS NULL` with the actual content and author from the Slack API response. This is a one-time catch-up that self-heals without creating duplicate LIAM memories.

```
// After the main import loop, backfill null-content rows
for (const msg of allMessages) {
  if (msg.subtype) continue;
  const messageId = `${channelId}_${msg.ts}`;
  await adminClient
    .from("slack_processed_messages")
    .update({
      message_content: (msg.text || "").substring(0, 500),
      author_name: msg.user || "unknown",
    })
    .eq("user_id", user.id)
    .eq("slack_message_id", messageId)
    .is("message_content", null);
}
```

Also update the toast response: when `totalImported === 0` but backfill occurred, surface that to the user. Add a `backfilled` count to the response so the frontend can show "Updated N existing messages" instead of the misleading "No new messages found."

**Frontend update** (`useSlackMessagesSync.ts` lines 263-266): Update the toast logic to handle the new `backfilled` field in the response.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/slack-messages-sync/index.ts` | Add backfill loop + return `backfilled` count |
| `src/hooks/useSlackMessagesSync.ts` | Update toast to show backfill info |

