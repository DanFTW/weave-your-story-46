

## Plan: Update Discord Message Tracker Active Monitoring to Match Slack

### Summary
Add Recent Messages, Trigger Word filter, and Search Channel sections to the Discord active monitoring screen, matching the Slack Message Monitor layout. This requires database changes, edge function updates, hook updates, type updates, and UI changes.

### 1. Database Migration
Add columns to `discord_automation_config` and `discord_processed_messages`:

```sql
ALTER TABLE discord_automation_config
  ADD COLUMN trigger_word text DEFAULT null,
  ADD COLUMN trigger_word_enabled boolean DEFAULT false;

ALTER TABLE discord_processed_messages
  ADD COLUMN message_content text DEFAULT null,
  ADD COLUMN author_name text DEFAULT null;
```

### 2. Edge Function (`discord-automation-triggers/index.ts`)

**Poll action** (~line 601): When inserting into `discord_processed_messages`, also store `message_content` (first 500 chars of `messageText`) and `author_name` (`authorDisplayName`). Before the message loop, read `trigger_word` and `trigger_word_enabled` from `pollConfig`. Skip messages that don't contain the trigger word (case-insensitive) when enabled.

**New `search` action**: Add a `search` case that fetches messages from the configured channel using the bot token with a query approach (fetch last 50 messages, filter by text match client-side since Discord has no search API for bots), deduplicates, and imports matches as memories. Pattern matches the Slack search action.

### 3. Types (`src/types/discordAutomation.ts`)

- Add `triggerWord` and `triggerWordEnabled` to `DiscordAutomationConfig`.
- Add `DiscordRecentMessage` interface: `{ id, discordMessageId, messageContent, authorName, createdAt }`.

### 4. Hook (`src/hooks/useDiscordAutomation.ts`)

- Add state: `recentMessages: DiscordRecentMessage[]`, `triggerWord`, `triggerWordEnabled`.
- Load `trigger_word`/`trigger_word_enabled` in `loadConfig`.
- Add `loadRecentMessages()`: fetches last 20 from `discord_processed_messages` where `message_content` is not null, ordered by `created_at desc`.
- Call `loadRecentMessages()` after `loadConfig` and after `syncNow`.
- Add `updateTriggerWord(word, enabled)`: updates `discord_automation_config` directly.
- Add `searchChannel(query)`: invokes edge function with `action: "search"`.
- Expose new state and functions in return.

### 5. UI (`discord-automation/ActiveMonitoring.tsx`)

Rewrite to match Slack's layout exactly, replacing the "How it works" section with:
1. **Recent Messages** — collapsible list with author avatars, timestamps, content preview (same markup as Slack, using `#5865F2` Discord brand color instead of `#4A154B`).
2. **Trigger Word Filter** — Switch + text input card (same as Slack).
3. **Search Channel** — Input + search button card (same as Slack).
4. Keep existing Sync Now / Pause / Reset buttons.

New props: `recentMessages`, `triggerWord`, `triggerWordEnabled`, `onUpdateTriggerWord`, `onSearch`.

### 6. Flow (`DiscordAutomationFlow.tsx`)

Pass new props from hook to `ActiveMonitoring`: `recentMessages`, `triggerWord`, `triggerWordEnabled`, `onUpdateTriggerWord`, `onSearch`, rename `isSyncing` usage to match.

### Files Changed
- New migration SQL
- `supabase/functions/discord-automation-triggers/index.ts`
- `src/types/discordAutomation.ts`
- `src/hooks/useDiscordAutomation.ts`
- `src/components/flows/discord-automation/ActiveMonitoring.tsx`
- `src/components/flows/discord-automation/DiscordAutomationFlow.tsx`
- `src/integrations/supabase/types.ts` (regenerated)

No changes to Slack or any other flow.

