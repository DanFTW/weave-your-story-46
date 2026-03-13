## Add Recent Messages Display to Slack Channel Monitor

### Problem

The `slack_processed_messages` table only stores `slack_message_id`, `user_id`, and `created_at` — no message content or author. There is nothing to display.

### Solution

**1. Database migration** — Add `message_content` and `author_name` columns to `slack_processed_messages`:

```sql
ALTER TABLE slack_processed_messages
  ADD COLUMN message_content text,
  ADD COLUMN author_name text;

```

**2. Edge function update** (`supabase/functions/slack-messages-sync/index.ts`) — When inserting into `slack_processed_messages` during poll and search actions, also store `message_content` (the raw `msg.text`, truncated to 500 chars) and `author_name` (from `msg.user`). Use `SLACKBOT_FETCH_CHANNEL_MESSAGES` as the Composio action when fetching channel messages, and confirm `SLACKBOT_SEARCH_MESSAGES` and `SLACKBOT_LIST_CHANNELS` are being used correctly elsewhere in the flow.

**3. Hook update** (`src/hooks/useSlackMessagesSync.ts`) — Add a `recentMessages` state array and a `fetchRecentMessages` function that queries `slack_processed_messages` ordered by `created_at DESC` with `limit(20)`. Call it on init when config is active, and after each successful sync/search.

**4. UI component** (`src/components/flows/slack-messages-sync/ActiveMonitoring.tsx`) — Add a collapsible "Recent Messages" section between the stats cards and the search section:

- Uses `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` from the existing UI library (same pattern as `DraftConfirmationScreen.tsx`)
- Header row: `ChevronDown`/`ChevronUp` toggle with message count badge
- Each message rendered as a compact card: author name, truncated content, relative timestamp
- Shows "No messages imported yet" empty state when the array is empty

**5. Flow component wiring** (`src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`) — Pass `recentMessages` as a new prop to `ActiveMonitoring`.

### Files changed


| File                                                                 | Change                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `slack_processed_messages` table                                     | Already applied manually in Supabase                         |
| `supabase/functions/slack-messages-sync/index.ts`                    | Store content + author on insert, use correct Composio slugs |
| `src/hooks/useSlackMessagesSync.ts`                                  | Add `recentMessages` state + fetch function                  |
| `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx`      | Add collapsible recent messages section                      |
| `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx` | Wire `recentMessages` prop                                   |
