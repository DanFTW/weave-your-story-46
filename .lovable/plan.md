

## Fix "Unknown"/"No Content" Messages + Add Multi-Channel Selection

### Root Cause: Null Content

Database query confirms all `slack_processed_messages` rows have `message_content: null` and `author_name: null`. The edge function code already includes these fields in the insert statement, but it was **never redeployed** after the columns were added. The running function is the old version without those fields. Fix: redeploy the edge function (no code changes needed — the code is already correct).

### Implementation

**1. Redeploy edge function** (`supabase/functions/slack-messages-sync/index.ts`)
- No code changes needed for the content fix — just needs redeployment
- Update the `poll` action to iterate over ALL `selected_channel_ids` instead of just `[0]`
- Build a combined result across channels

**2. Multi-channel selection — ChannelPicker** (`src/components/flows/slack-messages-sync/ChannelPicker.tsx`)
- Add checkbox-based multi-select (using existing `Checkbox` component)
- Add a "Start Monitoring (N)" confirm button at the bottom
- Change `onSelectChannel` prop to `onConfirmChannels(channels: SlackChannel[])`
- Track selected channels locally with `useState<Set<string>>`

**3. Hook updates** (`src/hooks/useSlackMessagesSync.ts`)
- Change `selectedChannelId`/`selectedChannelName` to arrays: `selectedChannelIds: string[]`, `selectedChannelNames: string[]`
- Update `selectChannel` → `selectChannels(channels: SlackChannel[])` to accept array
- Update `activate` to write all selected IDs/names to the config arrays
- Update `loadConfig` to read all array entries
- Update `stats.channelName` to show comma-joined channel names

**4. Types** (`src/types/slackMessagesSync.ts`)
- `SlackMessagesSyncConfig`: change `selectedChannelId`/`selectedChannelName` to arrays

**5. Flow wiring** (`src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`)
- Update `handleChannelSelected` to pass array from ChannelPicker
- Remove the auto-activate `useEffect` that triggers on `selectedChannelId`; instead trigger on the new multi-select confirm

**6. ActiveMonitoring** (`src/components/flows/slack-messages-sync/ActiveMonitoring.tsx`)
- Update channel info card to show multiple channel names (comma-separated or stacked chips)

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/slack-messages-sync/index.ts` | Poll all selected channels; redeploy |
| `src/components/flows/slack-messages-sync/ChannelPicker.tsx` | Multi-select with checkboxes + confirm button |
| `src/hooks/useSlackMessagesSync.ts` | Array-based channel selection |
| `src/types/slackMessagesSync.ts` | Array types for channel IDs/names |
| `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx` | Wire multi-select confirm flow |
| `src/components/flows/slack-messages-sync/ActiveMonitoring.tsx` | Display multiple channels |

