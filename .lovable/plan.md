

## Fix Author Display Names + Add DM Support

### Issue 1: Author shows Slack user ID instead of display name

**Root cause**: `conversations.history` returns `msg.user` as a Slack user ID (e.g. `U0ALCMWHZ7E`). The code stores this raw ID as `author_name`.

**Fix**: In the edge function's `poll` action, call `users.list` once at the start to build a `userId → displayName` map, then look up each `msg.user` against this map before storing. Also backfill existing rows with resolved names.

### Issue 2: DMs not fetched

**Root cause**: `conversations.list` is called with `types: "public_channel,private_channel"` — this excludes DMs (`im`) and group DMs (`mpim`).

**Fix**: 
- In the `list-channels` action, add `im,mpim` to the types parameter and include DMs in the response (using the user map to show the DM partner's name instead of the channel ID).
- In the `poll` action, DMs use the same `conversations.history` API, so no changes needed there beyond already iterating `channelIds`.
- Update `SlackChannel` type to include a `isDm` flag for UI differentiation.
- Update `ChannelPicker` to show DM entries with a user icon instead of `#`.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/slack-messages-sync/index.ts` | Add `users.list` call to build name map; resolve user IDs in poll/search/backfill; add `im,mpim` to `list-channels` types; format DM names |
| `src/types/slackMessagesSync.ts` | Add `isDm` to `SlackChannel` |
| `src/components/flows/slack-messages-sync/ChannelPicker.tsx` | Show DMs with user icon and display name |

### Edge function changes (detail)

**`list-channels` action**:
- Change types to `"public_channel,private_channel,im,mpim"`
- Call `users.list` to get user map
- For `im` channels, set `name` to the DM partner's display name, `isDm: true`
- For `mpim`, set name to participant names joined

**`poll` action**:
- Before the channel loop, call `users.list` once → build `Map<userId, displayName>`
- When inserting/backfilling, use `userMap.get(msg.user) || msg.user` instead of raw `msg.user`
- Also update the LIAM memory content string to use the resolved name

**`search` action**:
- Same user map lookup for `msg.username` (search results already return username, but add map as fallback)

