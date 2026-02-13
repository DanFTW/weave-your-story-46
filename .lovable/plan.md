# Fix Discord Server Loading -- Use Direct Discord API

## Root Cause

The edge function logs show every call to `DISCORD_LIST_MY_GUILDS` returns:

```
401 Client Error: Unauthorized for url: https://discord.com/api/v10/users/@me/guilds

```

Composio's tool execution is internally using an expired or invalid OAuth token. The channel-fetching code (lines 160-261) already works around this by fetching the fresh `access_token` from Composio's connected account metadata and calling Discord's REST API directly. The server-fetching code needs the same treatment.

The console errors in the screenshot (`ERR_BLOCKED_BY_CLIENT`) are from third-party analytics/tracking scripts blocked by an ad blocker -- they are unrelated to this issue.

## Solution

### `supabase/functions/discord-automation-triggers/index.ts` (1 file)

Replace the `get-servers` case (lines 89-148) to:

1. Fetch the OAuth `access_token` from Composio metadata: `GET /api/v3/connected_accounts/{connectionId}` (same code already used in `get-channels`)
2. Call Discord REST API directly: `GET https://discord.com/api/v10/users/@me/guilds` with `Authorization: Bearer {accessToken}`
3. Map the response to `{ id, name, icon }` server objects

To avoid duplicating the token-fetching logic, extract a shared helper function `getDiscordAccessToken(connectionId)` that both `get-servers` and `get-channels` can call.

### Refactored structure:

```
// Helper: fetch access token from Composio metadata (used by both actions)
async function getDiscordAccessToken(connectionId: string): Promise<string>

// get-servers: calls getDiscordAccessToken, then GET /users/@me/guilds
// get-channels: calls getDiscordAccessToken, then GET /guilds/{id}/channels

```

No frontend changes needed. No other files affected.

---

## Suggestions (only the deltas I’d make before you approve)

1. **Do not return an empty “no servers found” on API failure**
  - If Discord returns 401/403/429, return a non-200 response (or `{ error: ... }`) so the UI shows a real error state instead of an empty list.
2. **Validate the Composio identifier**
  - Ensure `connectionId` is the **Composio connected_account_id** (not an integration id / trigger id / internal DB id). If it isn’t, the metadata call will succeed/fail incorrectly and you’ll always get no servers.
3. **Add a clear reconnect message for missing Discord scopes**
  - If the token lacks required scopes (commonly `guilds`), surface: “Discord connection missing required scopes (guilds). Please reconnect Discord.” This prevents silent empty results.
4. **Add minimal rate-limit handling**
  - If Discord responds 429, respect `Retry-After` (or return a friendly “Rate limited, try again in X seconds” message).