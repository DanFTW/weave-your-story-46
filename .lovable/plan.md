

# Fix: Use Composio Tool Execution for Channel Listing

## Root Cause

The Discord REST API endpoint `GET /guilds/{guild_id}/channels` **requires Bot authorization** -- it does not work with regular user OAuth tokens regardless of scopes. The current code calls this endpoint directly with the user's OAuth `Bearer` token, which always returns `401 Unauthorized`.

Server listing works because `GET /users/@me/guilds` is a user OAuth endpoint. Channel listing is not.

## Solution

Instead of calling the Discord REST API directly, use **Composio Tool Execution** (`POST /api/v3/tools/execute/{ACTION_SLUG}`) to list channels. Composio handles the auth internally and can proxy the request correctly through the user's connected account. This is the same pattern already used successfully elsewhere in the codebase (e.g., Instagram, LinkedIn, Trello integrations).

## Changes

### 1. Edge Function: `supabase/functions/discord-automation-triggers/index.ts`

**Replace** the `get-channels` case (lines 231-302) to use Composio tool execution instead of direct Discord API calls:

```typescript
case "get-channels": {
  if (!serverId) {
    return new Response(JSON.stringify({ error: "serverId required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[Discord] Fetching channels via Composio for server: ${serverId}`);

  for (const connId of connectionIdsToUse) {
    try {
      const execRes = await fetch(
        `${COMPOSIO_API_BASE}/tools/execute/DISCORD_LIST_GUILD_CHANNELS`,
        {
          method: "POST",
          headers: {
            "x-api-key": COMPOSIO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connected_account_id: connId,
            arguments: { guild_id: serverId },
          }),
        }
      );

      const execText = await execRes.text();
      console.log(`[Discord] Composio channel exec status: ${execRes.status} (conn: ${connId}), body: ${execText.substring(0, 500)}`);

      if (!execRes.ok) continue;

      const execData = JSON.parse(execText);
      // Composio wraps results in data.response_data or similar
      const channelList = execData?.data?.response_data || execData?.response_data || execData?.data || [];
      const allChannels = Array.isArray(channelList) ? channelList : [];

      const textChannels = allChannels
        .filter((c: any) => c.type === 0)
        .map((c: any) => ({ id: c.id, name: c.name, type: c.type }));

      return new Response(JSON.stringify({ channels: textChannels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error(`[Discord] Composio channel exec failed for ${connId}:`, e);
      continue;
    }
  }

  // Fallback: all connections failed
  return new Response(JSON.stringify({
    error: "Failed to load channels",
    details: "All Discord connections failed. Please reconnect Discord.",
    channels: [],
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
```

If `DISCORD_LIST_GUILD_CHANNELS` is not the correct Composio action slug, the function will log the error and we can adjust. Common alternatives: `DISCORD_GET_GUILD_CHANNELS`, `DISCORD_LIST_CHANNELS`. The logs will reveal the correct slug.

### 2. Deploy edge function

Redeploy `discord-automation-triggers` after the change.

### 3. No frontend changes needed

The frontend already handles the response format (`channels` array) and the error/reconnect flow correctly from previous changes.

## Technical Notes

- This follows the same Composio tool execution pattern used by Trello (`TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD`), HubSpot, Instagram, and other integrations in the codebase
- The `connected_account_id` (ca_*) is passed to Composio which handles token refresh and API proxying
- If the action slug needs adjustment, the logs will show the exact error from Composio, making it easy to correct

