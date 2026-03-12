

## Slack Messages to Memory — Implementation Plan

### Overview
Create a new thread "Slack Messages to Memory" that imports Slack messages as memories. The thread flow: Connect Slack → Select Workspaces → Select Channels → Configure Search & Import mode. This follows the Discord automation pattern exactly (auth gate → multi-step picker → config → active monitoring).

### 1. Database Migration (2 tables)

**`slack_messages_config`** — mirrors `discord_automation_config`
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL
- `is_active` boolean DEFAULT false
- `search_mode` boolean DEFAULT false (on = search-based import, off = passive channel import)
- `selected_workspace_ids` text[] (selected workspace IDs)
- `selected_channel_ids` text[] (selected channel IDs)
- `messages_imported` integer DEFAULT 0
- `last_polled_at` timestamptz
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()
- RLS: authenticated user can SELECT/INSERT/UPDATE own rows

**`slack_processed_messages`** — dedup table
- `id` uuid PK default gen_random_uuid()
- `user_id` uuid NOT NULL
- `slack_message_id` text NOT NULL
- `created_at` timestamptz DEFAULT now()
- UNIQUE on (user_id, slack_message_id)
- RLS: authenticated user can SELECT/INSERT own rows

### 2. Edge Function: `slack-messages-sync`

Single edge function with actions:
- **`list-workspaces`** — Uses Composio `SLACK_LIST_WORKSPACES` or the Slack native token to list workspaces the user belongs to
- **`list-channels`** — Uses Composio `SLACK_FIND_CHANNELS` to list channels for selected workspaces
- **`activate`** / **`deactivate`** — Toggle `is_active` on config table
- **`poll`** — When `search_mode = true`, uses `SLACK_SEARCH_ALL` to search content across selected channels and save matches as memories. When `search_mode = false`, uses `SLACK_FIND_CHANNELS` to list channels then fetches recent messages and saves as memories.
- **`manual-sync`** — On-demand trigger of the poll action

Since Slack uses native OAuth (not Composio) in this project, the edge function will use the stored access token from `user_integrations` to call Slack APIs directly (`conversations.list`, `conversations.history`, `search.all`).

### 3. Types: `src/types/slackMessagesSync.ts`

```
SlackMessagesSyncPhase = "auth-check" | "select-workspaces" | "select-channels" | "configure" | "activating" | "active"
SlackWorkspace { id, name, icon? }
SlackChannel { id, name, workspaceId, workspaceName, isMember, isPrivate }
SlackMessagesSyncConfig { id, userId, isActive, searchMode, selectedWorkspaceIds, selectedChannelIds, messagesImported, lastPolledAt }
SlackMessagesSyncStats { messagesImported, lastPolled, isActive, searchMode }
```

### 4. Hook: `src/hooks/useSlackMessagesSync.ts`

Mirrors `useDiscordAutomation.ts` — manages phase state machine, loads config from DB, provides `fetchWorkspaces`, `fetchChannels`, `selectWorkspaces`, `selectChannels`, `setSearchMode`, `activate`, `deactivate`, `manualSync`, `resetConfig`.

### 5. UI Components: `src/components/flows/slack-messages-sync/`

Mirrors Discord automation component structure:
- **`index.ts`** — barrel export
- **`SlackMessagesSyncFlow.tsx`** — main flow with Slack auth gate (checks `user_integrations` for slack connection, redirects to `/integration/slack` if not connected)
- **`WorkspacePicker.tsx`** — multi-select toggle list of workspaces (default all selected)
- **`ChannelPicker.tsx`** — multi-select toggle list of channels grouped by workspace (default all selected)
- **`SyncConfig.tsx`** — Search & Import toggle (on/off), explanation of each mode, activate button
- **`ActiveMonitoring.tsx`** — stats, search mode indicator, manual sync, pause, reset
- **`ActivatingScreen.tsx`** — loading animation during activation

### 6. Registration (data + routing)

**`src/data/threads.ts`** — add entry:
```typescript
{
  id: "slack-messages-sync",
  title: "Slack Messages to Memory",
  description: "Import Slack messages from across workspaces and channels as memories",
  icon: MessageSquare, // or Hash
  gradient: "purple",
  status: "active",
  type: "automation",
  category: "social",
  integrations: ["slack"],
  triggerType: "automatic",
  flowMode: "thread",
}
```

**`src/data/threadConfigs.ts`** — add config with 4 steps (Connect Slack, Select Workspaces, Select Channels, Search & Import)

**`src/data/flowConfigs.ts`** — add entry with `isSlackMessagesSyncFlow: true`

**`src/types/flows.ts`** — add `isSlackMessagesSyncFlow?: boolean`

**`src/pages/FlowPage.tsx`** — import `SlackMessagesSyncFlow`, add render block for `config.isSlackMessagesSyncFlow`

**`src/pages/Threads.tsx`** — add `'slack-messages-sync'` to `flowEnabledThreads`

**`src/pages/ThreadOverview.tsx`** — add `'slack-messages-sync'` to `flowEnabledThreads`

### 7. Styling

- Thread card uses Slack brand color (`#4A154B` purple or the existing `purple` gradient) with Slack integration icon
- Flow header uses `thread-gradient-purple`
- All components follow existing `px-5`, `rounded-xl`, `bg-card border border-border` patterns
- CTA buttons use `h-14 rounded-2xl` standard
- Back button uses `w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm`

### Files to Create
1. `src/types/slackMessagesSync.ts`
2. `src/hooks/useSlackMessagesSync.ts`
3. `src/components/flows/slack-messages-sync/index.ts`
4. `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`
5. `src/components/flows/slack-messages-sync/WorkspacePicker.tsx`
6. `src/components/flows/slack-messages-sync/ChannelPicker.tsx`
7. `src/components/flows/slack-messages-sync/SyncConfig.tsx`
8. `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx`
9. `src/components/flows/slack-messages-sync/ActivatingScreen.tsx`
10. `supabase/functions/slack-messages-sync/index.ts`

### Files to Modify
1. `src/data/threads.ts` — add thread entry
2. `src/data/threadConfigs.ts` — add thread config
3. `src/data/flowConfigs.ts` — add flow config
4. `src/types/flows.ts` — add boolean flag
5. `src/pages/FlowPage.tsx` — import + render
6. `src/pages/Threads.tsx` — add to flowEnabledThreads
7. `src/pages/ThreadOverview.tsx` — add to flowEnabledThreads

### Database Migration
- 2 new tables with RLS policies + updated_at trigger on `slack_messages_config`

