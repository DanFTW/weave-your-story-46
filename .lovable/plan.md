

## Trigger Word Filter for Slack Message Monitor

### Overview
Add a trigger word feature so users can optionally filter which Slack messages get saved to memory. When enabled, only messages containing the trigger word (case-insensitive) are imported.

### 1. Database Migration
Add two columns to `slack_messages_config`:
```sql
ALTER TABLE slack_messages_config
  ADD COLUMN trigger_word text DEFAULT null,
  ADD COLUMN trigger_word_enabled boolean DEFAULT false;
```

### 2. Edge Function (`supabase/functions/slack-messages-sync/index.ts`)
In the `poll` action, after fetching `configData`, read `trigger_word` and `trigger_word_enabled`. Inside the message loop (line ~330), after the `if (msg.subtype) continue;` check, add:
```
if trigger_word_enabled && trigger_word is set:
  skip message if msg.text doesn't contain trigger_word (case-insensitive)
```
No changes to `search`, `activate`, `deactivate`, or any other action.

### 3. Hook (`src/hooks/useSlackMessagesSync.ts`)
- Add state: `triggerWord` (string), `triggerWordEnabled` (boolean).
- Load from config in `loadConfig`.
- Add `updateTriggerWord(word: string, enabled: boolean)` callback that updates `slack_messages_config` directly via Supabase client.
- Expose in return object.

### 4. Types (`src/types/slackMessagesSync.ts`)
- Add `triggerWord` and `triggerWordEnabled` to `SlackMessagesSyncConfig`.

### 5. UI (`src/components/flows/slack-messages-sync/ActiveMonitoring.tsx`)
- Accept `triggerWord`, `triggerWordEnabled`, and `onUpdateTriggerWord` as new props.
- Add a card between the search section and actions with:
  - A text input for the trigger word.
  - A toggle (Switch) to enable/disable.
  - Save triggers `onUpdateTriggerWord`.

### 6. Flow (`SlackMessagesSyncFlow.tsx`)
- Pass the new props from the hook through to `ActiveMonitoring`.

