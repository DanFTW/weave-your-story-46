

## Add "Sync Now" to Discord Message Tracker

### Overview
Add a manual sync button to the Discord ActiveMonitoring screen, matching the Slack Channel Monitor's pattern. This requires changes at three layers: edge function, hook, and UI component.

### Changes

**1. Edge function — add `poll` action** (`supabase/functions/discord-automation-triggers/index.ts`)

Add a new `case "poll"` that:
- Reads the user's `discord_automation_config` to get `channel_id`, `channel_name`, `user_id`
- Fetches recent messages from `GET https://discord.com/api/v10/channels/{channelId}/messages?limit=50` using the `DISCORD_BOT_TOKEN` secret
- For each message: skips bot messages and empty content, deduplicates against `discord_processed_messages`, formats the memory string (same format as the webhook), calls `liam-memory` to create the memory, inserts into `discord_processed_messages`
- Updates `messages_tracked` and `last_checked_at` on the config row
- Returns `{ messagesImported: count }` 

**2. Hook — add `syncNow` function** (`src/hooks/useDiscordAutomation.ts`)

- Add `syncNow` to the interface and return object
- Add `isSyncing` state boolean
- `syncNow` invokes `discord-automation-triggers` with `action: "poll"`, updates stats on success, shows toast feedback

**3. UI component — add Sync Now button** (`src/components/flows/discord-automation/ActiveMonitoring.tsx`)

- Add `onSyncNow` and `isSyncing` props
- Add a `RefreshCw` icon button before "Pause Monitoring", matching the Slack pattern exactly:
  ```
  <Button variant="outline" onClick={onSyncNow} disabled={isLoading || isSyncing} className="w-full h-12">
    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
    {isSyncing ? "Syncing..." : "Sync Now"}
  </Button>
  ```

**4. Flow component — wire props** (`src/components/flows/discord-automation/DiscordAutomationFlow.tsx`)

- Destructure `syncNow` and `isSyncing` from the hook
- Pass `onSyncNow={syncNow}` and `isSyncing={isSyncing}` to `ActiveMonitoring`

