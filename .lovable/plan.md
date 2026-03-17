

## Problem

The "Messages" count on the Discord tracker monitoring page reads from `discord_automation_config.messages_tracked` (a counter column incremented by the webhook). This counter is unreliable -- it shows 0 or 2 while the actual `discord_processed_messages` table has 46 records per user. The webhook's increment logic uses `(config.messages_tracked || 0) + 1` which is race-prone and was likely reset during config upserts.

## Fix -- 1 file

**`src/hooks/useDiscordAutomation.ts`**

Instead of trusting the `messages_tracked` column, query the true count from `discord_processed_messages` and use that for the stats display.

1. Add a `loadMessageCount` helper that runs:
   ```sql
   SELECT count(*) FROM discord_processed_messages WHERE user_id = ?
   ```
2. Store the result in a new `messageCount` state variable.
3. Update the `stats` object to use `messageCount` instead of `config?.messagesTracked`.
4. Call `loadMessageCount` alongside `loadRecentMessages` -- in `loadConfig` (when active), after `syncNow`, and after `searchChannel`.

### Changes in detail

- **New state**: `const [messageCount, setMessageCount] = useState(0);`
- **New function** `loadMessageCount`: queries `discord_processed_messages` with `.select('id', { count: 'exact', head: true })` and sets `messageCount` from the count.
- **Stats derivation** (line 56-60): change `messagesTracked: config?.messagesTracked ?? 0` to `messagesTracked: messageCount`.
- **Call sites**: add `await loadMessageCount()` next to every `await loadRecentMessages()` call (lines 124, 491, 560) and reset to 0 in `resetConfig`.

