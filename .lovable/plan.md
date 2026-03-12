

## Rename & Restructure: "Slack Channel Monitor"

### Summary
Rename "Slack Messages to Memory" → "Slack Channel Monitor" and change the flow from multi-channel selection to single-channel selection (matching the Discord pattern): Connect Slack → Select Channel → Monitor & Search (active state imports all messages from any user in the selected channel, plus on-demand search).

### Changes

#### 1. Data files (title/description updates only)

**`src/data/threads.ts`** (lines 6-8):
- `title`: "Slack Channel Monitor"
- `description`: "Monitor a Slack channel and import all messages as memories"

**`src/data/threadConfigs.ts`** (lines 1137-1175):
- Update title to "Slack Channel Monitor", subtitle to "Monitor channel messages"
- Change steps to 3: Connect Slack → Select Channel → Always-On Monitoring

**`src/data/flowConfigs.ts`** (lines 627-639):
- Update title/subtitle to "Slack Channel Monitor" / "Channel message monitoring"

#### 2. Types (`src/types/slackMessagesSync.ts`)
- Simplify phases to: `'auth-check' | 'select-channels' | 'activating' | 'active'` (remove `'configure'`)
- Add `selectedChannelId: string | null` and `selectedChannelName: string | null` to config type
- Remove `searchMode` from config/stats (search is always available in active state)

#### 3. Hook (`src/hooks/useSlackMessagesSync.ts`)
- Replace multi-select channel logic with single-channel selection (`selectChannel(id, name)`)
- Remove `searchMode`, `setSearchMode`, `selectAllChannels`, `deselectAllChannels`, `toggleChannel`
- Remove `configure` phase — selecting a channel goes straight to `activating` → `active`
- Add `manualSearch(query)` for on-demand search from active state
- Keep `fetchChannels`, `activate`, `deactivate`, `manualSync`, `resetConfig`

#### 4. UI Components (`src/components/flows/slack-messages-sync/`)

**Remove**: `SyncConfig.tsx` (no longer needed — no configure step)

**`ChannelPicker.tsx`**: Convert from multi-select toggle to single-select list (like Discord's ChannelPicker). Clicking a channel selects it and proceeds. Remove select all/deselect all buttons and the "Continue with N channels" CTA.

**`SlackMessagesSyncFlow.tsx`**: Remove `configure` phase rendering. Selecting a channel triggers `activate()` directly. Remove `SyncConfig` import. Update header subtitle. Title → "Slack Channel Monitor".

**`ActiveMonitoring.tsx`**: 
- Update title to "Slack Channel Monitor"
- Show single channel name instead of channel count
- Replace search mode indicator with a search input that calls `manualSearch(query)` 
- Keep: Sync Now, Pause, Reset buttons and stats

**`ActivatingScreen.tsx`**: Update text to "Activating Slack Channel Monitor"

#### 5. Edge function (`supabase/functions/slack-messages-sync/index.ts`)
- `poll` action: Always fetch `conversations.history` for the single selected channel (all users' messages). Remove search mode branch from poll.
- Add `search` action: accepts `query` param, calls `search.all` scoped to the selected channel, saves matches as memories. This is triggered on-demand from the UI.
- Read `selected_channel_ids[0]` as the single channel (no DB schema change needed).

#### 6. Database
No migration needed — `slack_messages_config` already has `selected_channel_ids` (array) which can hold a single element, and `search_mode` can simply be ignored.

### Files Modified
1. `src/data/threads.ts` — rename
2. `src/data/threadConfigs.ts` — rename + simplify steps
3. `src/data/flowConfigs.ts` — rename
4. `src/types/slackMessagesSync.ts` — simplify types
5. `src/hooks/useSlackMessagesSync.ts` — single-channel logic, add search
6. `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx` — remove configure phase
7. `src/components/flows/slack-messages-sync/ChannelPicker.tsx` — single-select
8. `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx` — channel name + search UI
9. `src/components/flows/slack-messages-sync/ActivatingScreen.tsx` — rename text
10. `src/components/flows/slack-messages-sync/SyncConfig.tsx` — delete
11. `supabase/functions/slack-messages-sync/index.ts` — add search action, simplify poll

