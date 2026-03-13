

## Plan: Add Workspace Selection Step to Slack Channel Monitor

### Context
The Discord automation flow follows: auth-check → select-server → select-channel → configure → active. The Slack flow currently skips from auth-check straight to select-channels. We need to add a "select-workspace" step in between.

Since Slack OAuth tokens are workspace-scoped (one token = one workspace), this step will fetch the workspace info via `team.info` API and display it for the user to confirm/select before proceeding to channel selection.

### Changes

**1. Add `select-workspace` phase to types** (`src/types/slackMessagesSync.ts`)
- Add `'select-workspace'` to `SlackMessagesSyncPhase` union
- Add `SlackWorkspace` interface with `id`, `name`, `icon` fields

**2. Add `list-workspace` action to edge function** (`supabase/functions/slack-messages-sync/index.ts`)
- Add handler for `action === "list-workspace"` that calls `team.info` Slack API
- Return workspace object `{ id, name, icon }` from the team data

**3. Add workspace state to hook** (`src/hooks/useSlackMessagesSync.ts`)
- Add `workspace` state and `fetchWorkspace` function
- `fetchWorkspace` invokes the edge function with `action: "list-workspace"`
- After workspace is fetched, stay on `select-workspace` phase until user selects it
- Add `selectWorkspace` callback that transitions to `select-channels` phase
- Update `loadConfig` to go to `select-workspace` (not `select-channels`) when no active config

**4. Create `WorkspacePicker` component** (`src/components/flows/slack-messages-sync/WorkspacePicker.tsx`)
- Follow the same pattern as Discord's `ServerPicker`
- Show loading state, error state, and the workspace card with icon/name
- Single selectable workspace card (since Slack tokens are workspace-scoped)
- Include refresh button

**5. Update `SlackMessagesSyncFlow`** (`src/components/flows/slack-messages-sync/SlackMessagesSyncFlow.tsx`)
- Import and render `WorkspacePicker` when `phase === "select-workspace"`
- Update header subtitle to show "Select a workspace" for that phase
- Update back button: from `select-channels` go back to `select-workspace`, from `select-workspace` go to `/threads`
- On workspace selected, transition to `select-channels` and fetch channels

### Flow after changes
```
auth-check → select-workspace → select-channels → activating → active
```

