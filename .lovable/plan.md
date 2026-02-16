

# Fix: Discord Channel Listing Fails After Server Selection

## Root Cause Analysis

After tracing through the full code path and inspecting the actual network responses, the root cause is now clear:

1. **Server listing uses `GET /users/@me/guilds`** -- a user-scoped endpoint that works with OAuth2 Bearer tokens. This succeeds and returns 90+ servers the user is in.

2. **Channel listing uses `GET /guilds/{guild_id}/channels`** -- a bot-scoped endpoint. This endpoint is **not accessible via user OAuth2 tokens**. It requires a **bot token** where the bot is a member of the guild.

3. **The bot is only in servers the user added it to during the Composio OAuth flow** (likely just 1 server). When the user selects any other server, the bot has no access, and Discord returns 401/403 for both token schemes.

4. **The reconnect case uses auth config `ac_m8FL09HNW-yx`**, but the `composio-connect` function uses `ac_jECZy5E0ycKY` for `discordbot`. This mismatch causes the reconnect to fail with HTTP 400.

## Solution

### 1. Server List Intersection (Primary Fix)

In the `get-servers` handler, fetch guilds from **both** the user OAuth token and the bot token. Return only the **intersection** -- servers where both the user and bot are present. This guarantees that any server the user selects will allow channel listing.

If the bot has no accessible servers, return all user servers with a clear error indicating the bot needs to be added.

### 2. Fix Reconnect Auth Config

Change the `reconnect` case to use `ac_jECZy5E0ycKY` (matching `composio-connect`) instead of `ac_m8FL09HNW-yx`.

### 3. Improve Error Messages for 403/401 on Channel Listing

When channel listing fails because the bot is not in the server:
- Do NOT prompt "Reconnect Discord"
- Show a clear message: "The bot is not in this server. Please pick a server the bot has been added to." with a "Pick a different server" option
- Only show reconnect for genuinely expired/invalid tokens (verified by checking if the bot can list ANY guilds)

### 4. Frontend: Tighten `needsReconnect` Detection

In `useDiscordAutomation.ts`, stop detecting "reconnect" by substring matching on error messages. Instead, check for an explicit `requiresReconnect` boolean field in the response body.

## Files to Change

| File | Change |
|------|--------|
| `supabase/functions/discord-automation-triggers/index.ts` | `get-servers`: intersect user + bot guilds. `get-channels`: return explicit `requiresReconnect` field. `reconnect`: fix auth config ID. |
| `src/hooks/useDiscordAutomation.ts` | Use `channelData.requiresReconnect` boolean instead of substring matching for reconnect detection. |

## Detailed Changes

### Edge Function (`discord-automation-triggers/index.ts`)

**`get-servers` case:**
- After fetching user guilds (existing logic), also fetch bot guilds using the bot connection
- Compute intersection by guild ID
- Return only intersected servers
- If no intersection, return all user servers with a warning flag

**`get-channels` case:**
- Add explicit `requiresReconnect: true/false` to every response
- On 403: set `requiresReconnect: false` (bot not in server, not an auth issue)
- On 401 after retry: set `requiresReconnect: true` (genuine token issue)

**`reconnect` case:**
- Change auth config from `ac_m8FL09HNW-yx` to `ac_jECZy5E0ycKY`

### Frontend Hook (`useDiscordAutomation.ts`)

**`selectServer` callback (lines 230-239):**
```
// Before (fragile substring matching):
const isChannelAuthFailure =
  channelData.details?.includes("All Discord connections failed") ||
  channelData.error?.includes("reconnect") ||
  errorMsg.includes("reconnect");

// After (explicit boolean):
const isChannelAuthFailure = channelData.requiresReconnect === true;
```

## What This Does NOT Change

- No UI/visual changes to ChannelPicker, ServerPicker, or other components
- No changes to the activate/deactivate/webhook flows
- The `DISCORD_NEW_MESSAGE_TRIGGER` slug (already correct in the activate case)
- No unrelated refactors

