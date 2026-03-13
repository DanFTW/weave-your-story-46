

## Analysis: Channel Fetch Ignores Selected Workspace

**Root Cause:**

The `list-channels` action in `slack-messages-sync` calls `conversations.list` without a `team` parameter (line 210-214). The Slack API's `conversations.list` accepts an optional `team` parameter to scope results to a specific workspace. Without it, Slack returns channels from the token's default workspace, which may differ from the workspace the user just selected -- particularly in Enterprise Grid setups or when tokens span multiple workspaces.

The frontend also never sends the workspace ID when requesting channels. `handleWorkspaceSelected` (line 153) calls `fetchChannels()` with no arguments, and the hook sends `{ action: "list-channels" }` with no `teamId`.

```text
Current flow:
  User selects workspace (id: T077CD18ZQD)
  → fetchChannels() sends { action: "list-channels" }
  → conversations.list called WITHOUT team param
  → Slack returns channels from token's default workspace (may differ)

Fixed flow:
  User selects workspace (id: T077CD18ZQD)
  → fetchChannels("T077CD18ZQD") sends { action: "list-channels", teamId: "T077CD18ZQD" }
  → conversations.list called WITH team: "T077CD18ZQD"
  → Slack returns channels for selected workspace
```

### Changes

**1. `src/hooks/useSlackMessagesSync.ts`** -- Update `fetchChannels` to accept an optional `teamId` parameter and pass it in the request body.

**2. `src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`** -- Pass `workspace.id` to `fetchChannels` in `handleWorkspaceSelected`, and update the `ChannelPicker` refresh callback to also pass it.

**3. `supabase/functions/slack-messages-sync/index.ts`** -- In the `list-channels` action, read `teamId` from the request body and pass it as the `team` parameter to `conversations.list`.

