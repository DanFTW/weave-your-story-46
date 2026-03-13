

## Fix Plan: Discord Message Tracker Flow (Fixes 1, 3, 4, 5)

### Fix 1 — Robust token extraction in edge function
**File**: `supabase/functions/discord-automation-triggers/index.ts` (line 46)

Current `getDiscordCredentials` only checks two token paths:
```
meta?.connectionParams?.access_token || meta?.data?.access_token
```

Per the established Composio token extraction pattern (see memory), also check `data.params.access_token` and `data.connection_params.access_token`:
```
meta?.connectionParams?.access_token
|| meta?.data?.access_token
|| meta?.data?.params?.access_token
|| meta?.data?.connectionParams?.access_token
|| meta?.data?.connection_params?.access_token
```

### Fix 3 — Better error message when bot token is expired
**File**: `supabase/functions/discord-automation-triggers/index.ts` (lines 370-381)

The fallback error after all connections fail says "All available Discord connections failed to list channels." — this is unhelpful. Improve:
- Track which connections failed with 401 specifically.
- If the bot connection returned 401, return a targeted message: "Discord bot authorization has expired. Please reconnect Discord." with `requiresReconnect: true`.

### Fix 4 — `deactivateMonitoring` phase transition
**File**: `src/hooks/useDiscordAutomation.ts` (line 361)

`deactivateMonitoring` sets phase to `"configure"` which is correct for "pause" (user wants to re-activate from the same channel). No change needed here — the previous analysis was about the Slack hook, not Discord. This is already correct.

### Fix 5 — Auto-fetch servers when phase enters `select-server`
**File**: `src/components/flows/discord-automation/DiscordAutomationFlow.tsx`

When `loadConfig` finds no existing config (or config with no server), it sets phase to `select-server` but never triggers `fetchServers()`. The `ServerPicker` renders an empty list requiring manual refresh.

Add a `useEffect` that calls `fetchServers()` when `phase === "select-server"` and `servers.length === 0` and `!isLoading`:

```ts
useEffect(() => {
  if (phase === "select-server" && servers.length === 0 && !isLoading && !hasLoadError) {
    fetchServers();
  }
}, [phase, servers.length, isLoading, hasLoadError, fetchServers]);
```

### Summary of changes
| # | File | Change |
|---|------|--------|
| 1 | Edge function | Add 3 additional token extraction paths |
| 3 | Edge function | Targeted error when bot token expired |
| 5 | Flow component | Auto-fetch servers on phase entry |

