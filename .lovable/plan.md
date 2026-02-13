# Fix Discord Server/Channel Loading

## Problem

The edge function uses incorrect Composio tool slugs:

- `DISCORD_LIST_CURRENT_USER_GUILDS` does not exist -- the correct slug is `DISCORD_LIST_MY_GUILDS`
- `DISCORD_LIST_GUILD_CHANNELS` does not exist in the Discord (non-bot) toolkit -- channel listing is only available in the Discord Bot toolkit

The Discord (non-bot) toolkit only has 15 tools and 1 trigger (`DISCORD_NEW_MESSAGE_TRIGGER`). It does NOT include a channel-listing tool.

## Solution

### 1. Fix server fetching (wrong tool slug)

In `supabase/functions/discord-automation-triggers/index.ts`, change:

- `DISCORD_LIST_CURRENT_USER_GUILDS` to `DISCORD_LIST_MY_GUILDS`

### 2. Fix channel fetching (tool doesn't exist in this toolkit)

Since `DISCORD_LIST_GUILD_CHANNELS` is not available in the Discord OAuth toolkit, we need to use the **Direct Discord REST API** instead. The approach:

1. Fetch the user's OAuth access token from the Composio connection metadata (`GET /api/v3/connected_accounts/{connectionId}`)
2. Call the Discord REST API directly: `GET https://discord.com/api/v10/guilds/{guild_id}/channels` with `Authorization: Bearer {accessToken}`
3. Filter to text channels (type 0)

This mirrors the same Composio-first pattern already used in `fetchDiscordProfile` in the callback function.

### 3. Confirm trigger slug is correct

The user's screenshot confirms the trigger slug is `DISCORD_NEW_MESSAGE_TRIGGER` with params `channel_id` (required), `interval` (default 1), and `limit` (default 50). This matches what is already in the code -- no change needed for the trigger.

## File Changes

### `supabase/functions/discord-automation-triggers/index.ts` (1 file)

**get-servers action** (~line 93): Replace `DISCORD_LIST_CURRENT_USER_GUILDS` with `DISCORD_LIST_MY_GUILDS`

**get-channels action** (~lines 160-218): Replace the Composio tool execution call with:

1. Fetch the access token from the Composio connection metadata endpoint
2. Call Discord REST API `GET /guilds/{serverId}/channels` directly using that token
3. Keep the existing text-channel filtering (type 0) and response format

No other files need changes.

## Technical Details

### Access Token Retrieval

```text
GET https://backend.composio.dev/api/v3/connected_accounts/{connectionId}
Headers: x-api-key: {COMPOSIO_API_KEY}
Response: { data: { access_token: "...", ... } }

```

### Discord Channel Listing

```text
GET https://discord.com/api/v10/guilds/{guild_id}/channels
Headers: Authorization: Bearer {access_token}
Response: [{ id, name, type, position, ... }, ...]

```

Channels with `type: 0` are text channels, which we filter to and return.

---

## Suggestions (only the deltas I’d make before you approve)

1. **Use the actual Composio connected account id**
  - Everywhere the plan says `{connectionId}`, use the same `connected_account_id` you already store for the Discord integration (Composio calls this a connected account). Don’t introduce a new “connection id” concept.
2. **Add basic error hardening (no UI changes)**
  - If the Composio metadata call returns no `access_token`, return a clear 401-style error: `"Discord not connected or token unavailable"`.
  - If Discord channel listing returns `401/403`, return a specific message (e.g. `"Discord token lacks permission to list channels for this server"`), so your UI isn’t forced to show “temporary issue” for permanent auth problems.
3. **Add timeouts + minimal logging**
  - Add a short timeout (e.g., 10s) to both network calls.
  - Log only status + a short snippet (first ~500 chars) of the response body for debugging.