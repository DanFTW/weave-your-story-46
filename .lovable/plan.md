# Fix: Discord Channel Listing (Tool Slug Not Found)

## Root Cause

The Composio action slug `DISCORD_LIST_GUILD_CHANNELS` does not exist in the Composio tool registry. Every call returns HTTP 404:

```
Tool DISCORD_LIST_GUILD_CHANNELS not found

```

Both connected accounts (`ca_ObvSuQAV8UZW` for user OAuth, `ca_seifjoPKRVN6` for bot) fail identically.

**Additional logic gap (still causes “failed to load channels” even after fixing the slug):** server listing can succeed via user OAuth (shows guilds the user is in), but channel listing requires bot authorization. If the user selects a server the bot is not in (or lacks permissions for), `GET /guilds/{guild_id}/channels` will return 403/404 and the UI may incorrectly prompt to reconnect.

## Solution

Replace the Composio Tool Execution approach with a **direct Discord REST API call** using the bot token retrieved via `getDiscordCredentials()`. This is the same proven pattern already used successfully for server listing (`GET /users/@me/guilds`).

The endpoint `GET /guilds/{guild_id}/channels` requires Bot authorization, which the `discordbot` connection provides.

**Suggestion:** ensure server selection and channel listing use consistent authorization (bot-first), and only prompt “reconnect” for true auth failures (401). Treat 403 as missing access/permissions (not reconnect).

## Change

### File: `supabase/functions/discord-automation-triggers/index.ts`

**Replace** the `get-channels` case (lines 231-285) to use direct Discord API calls instead of Composio tool execution:

- Loop through `connectionIdsToUse` (bot connection is included, and should be tried first)
- Call `getDiscordCredentials(connId)` to get the auth header
- Fetch `https://discord.com/api/v10/guilds/{serverId}/channels`
- Filter for text channels (type 0) and announcement channels (type 5)
- Handle 401/403 by trying the next connection, 429 with rate-limit messaging
- **Suggestion:** only fall back to "reconnect" messaging for 401 after all connections fail; treat 403 as “missing access / bot not in server / insufficient permissions” (do not prompt reconnect)
- Fall back to "reconnect" messaging only if all connections fail

This mirrors the `get-servers` case logic exactly, just targeting a different Discord endpoint.

**Suggestion (recommended to prevent step-2 failures):** update the `get-servers` case to prefer bot authorization (or filter/intersect servers to those the bot can access) so the user can’t select a server that will inevitably 403 on channel listing.

### Deploy

Redeploy the `discord-automation-triggers` edge function after the change.

### No frontend changes needed

The frontend `ChannelPicker` component already handles the `{ channels: [...] }` response format and the error/reconnect flow correctly.