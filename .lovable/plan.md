# Discord Channel Message Tracker

## Overview

Create a new "Discord Channel Message Tracker" thread that automatically saves new messages from a selected Discord channel as memories using the Composio `DISCORD_NEW_MESSAGE_TRIGGER` webhook.

## Architecture

Follows the exact same pattern as the Trello Task Tracker (server/channel picker) and HubSpot Contact Tracker (webhook trigger activation).

## Flow

1. Connect to Discord (auth gate via `useComposio('DISCORD')`)
2. Select Server -> Select Channel (two-step picker, like Trello's Board -> List)
3. Toggle monitoring on/off (webhook-based via `DISCORD_NEW_MESSAGE_TRIGGER`)

## Files to Create

### Types

`src/types/discordAutomation.ts`

- `DiscordAutomationPhase`: `'auth-check' | 'select-server' | 'select-channel' | 'configure' | 'activating' | 'active'`
- `DiscordServer`: `{ id, name, icon? }`
- `DiscordChannel`: `{ id, name, type }`
- `DiscordAutomationConfig`: `{ id, userId, serverId, serverName, channelId, channelName, isActive, triggerInstanceId, connectedAccountId, messagesTracked }`
- `DiscordAutomationStats`: `{ messagesTracked, lastChecked, isActive }`

### Hook

`src/hooks/useDiscordAutomation.ts`

- Manages phases, config loading/creation from `discord_automation_config` table
- `fetchServers()` -- calls edge function with `action: 'get-servers'`
- `selectServer()` -- stores selection, fetches channels via `action: 'get-channels'`
- `selectChannel()` -- stores selection, transitions to configure phase
- `activateMonitoring()` / `deactivateMonitoring()` -- calls edge function with `action: 'activate'` / `action: 'deactivate'`
- Pattern follows `useTrelloAutomation` (picker phases) + `useHubSpotAutomation` (webhook activation)

### Flow Components (5 files)

`src/components/flows/discord-automation/DiscordAutomationFlow.tsx`

- Main flow component, same structure as `TrelloAutomationFlow.tsx`
- Auth gate with `useComposio('DISCORD')`, sessionStorage return path `returnAfterDiscordConnect`
- Renders ServerPicker -> ChannelPicker -> AutomationConfig -> ActiveMonitoring based on phase

`src/components/flows/discord-automation/ServerPicker.tsx`

- Lists Discord servers (guilds) the user belongs to
- Same pattern as `BoardPicker.tsx` (loading, error, empty states, card list)
- Uses Discord Blurple (`#5865F2`) accent color

`src/components/flows/discord-automation/ChannelPicker.tsx`

- Lists text channels in the selected server
- Same pattern as `ListPicker.tsx`
- Filters to text channels only (type 0)

`src/components/flows/discord-automation/AutomationConfig.tsx`

- Single toggle for "New Messages" monitoring
- "Activate Monitoring" button, same as HubSpot `AutomationConfig.tsx`

`src/components/flows/discord-automation/ActiveMonitoring.tsx`

- Status card with pulse indicator, stats (messages tracked, last checked)
- Pause button, same pattern as HubSpot `ActiveMonitoring.tsx`

`src/components/flows/discord-automation/ActivatingScreen.tsx`

- Loading spinner screen during webhook setup

`src/components/flows/discord-automation/index.ts`

- Barrel export

### Edge Function

`supabase/functions/discord-automation-triggers/index.ts`

- Actions: `get-servers`, `get-channels`, `activate`, `deactivate`
- `get-servers`: Composio tool execution `DISCORD_LIST_GUILDS`
- `get-channels`: Composio tool execution `DISCORD_LIST_GUILD_CHANNELS` filtered to text channels (type 0)
- `activate`: Creates `DISCORD_NEW_MESSAGE_TRIGGER` via Composio trigger upsert API, with `channel_id` in `trigger_config`, webhook URL pointing to `discord-automation-webhook`, stores `trigger_instance_id` and `connected_account_id` in DB
- `deactivate`: Deletes trigger instance, sets `is_active = false`
- Auth pattern identical to `trello-automation-triggers`

`supabase/functions/discord-automation-webhook/index.ts`

- Receives webhook payloads from Composio for `DISCORD_NEW_MESSAGE_TRIGGER`
- Extracts `trigger_instance_id` from payload, looks up user via `discord_automation_config.trigger_instance_id` (and confirms `connected_account_id` matches)
- Extracts message content, author, channel name, timestamp
- Deduplicates via `discord_processed_messages` table
- Creates memory via LIAM API (same ECDSA signing pattern as all other webhooks)
- Formats memory as: "Discord Message in #channel-name\n\nFrom: username\nMessage: content\nSent: date"

### Database (2 tables via migration)

`discord_automation_config`

- `id` (uuid PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL, unique)
- `server_id` (text, nullable)
- `server_name` (text, nullable)
- `channel_id` (text, nullable)
- `channel_name` (text, nullable)
- `is_active` (boolean, default false)
- `trigger_instance_id` (text, nullable)
- `connected_account_id` (text, nullable)
- `messages_tracked` (integer, default 0)
- `last_checked_at` (timestamptz, nullable)
- `created_at` / `updated_at` (timestamptz, default now())
- RLS: users can only read/update their own row

`discord_processed_messages`

- `id` (uuid PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL)
- `discord_message_id` (text, NOT NULL)
- `created_at` (timestamptz, default now())
- Unique constraint on `(user_id, discord_message_id)`
- RLS: users can only read their own rows

## Files to Modify

### `src/data/threads.ts`

- Add new thread entry:
  - `id: "discord-tracker"`, `title: "Discord Channel Message Tracker"`
  - `description: "Automatically save new messages from a selected channel as memories"`
  - `icon: MessageSquare` (from lucide-react)
  - `gradient: "purple"`, `integrations: ["discord"]`
  - `flowMode: "thread"`, `triggerType: "automatic"`, `type: "automation"`

### `src/data/threadConfigs.ts`

- Add `"discord-tracker"` config with 3 steps: Connect Discord, Server/Channel to monitor, Toggle monitoring on/off
- Uses `discord.svg` icon URL for the connect step

### `src/data/flowConfigs.ts`

- Add `"discord-tracker"` entry with `isDiscordAutomationFlow: true`

### `src/types/flows.ts`

- Add `isDiscordAutomationFlow?: boolean` to `FlowConfig` interface

### `src/pages/Threads.tsx`

- Add `"discord-tracker"` to `flowEnabledThreads` array

### `src/pages/ThreadOverview.tsx`

- Add `"discord-tracker"` to `flowEnabledThreads` array (line 36)

### `src/pages/FlowPage.tsx`

- Import `DiscordAutomationFlow`
- Add `if (config.isDiscordAutomationFlow)` render block (follows existing pattern)

### `supabase/config.toml`

- Add `[functions.discord-automation-triggers]` with `verify_jwt = true`
- Add `[functions.discord-automation-webhook]` with `verify_jwt = false`

## Technical Notes

- The Discord `DISCORD_NEW_MESSAGE_TRIGGER` requires `channel_id` in its trigger config to scope monitoring to a single channel
- Server/channel fetching uses Composio tool execution API (`/api/v3/tools/execute/{ACTION_SLUG}`) with the user's `connected_account_id`
- Webhook deduplication uses Discord's unique message ID to prevent duplicate memories
- Memory creation is routed through LIAM API with ECDSA signing, consistent with all other automation threads