

## Root Cause Analysis: Discord Channel Listing 401

### The Problem

The `get-channels` action fails with 401 on ALL connections despite `get-servers` working fine. The logs confirm:

```text
get-servers flow:
  discordbot (ca_q7ZCuMZhmxET) → users/@me/guilds → 200 ✓ (95 guilds)
  discord    (ca_cfsE1mvRdQyj) → users/@me/guilds → 429 (rate limited)

get-channels flow:
  discordbot → guilds/{id}/channels with Bearer → 401 ✗
  discordbot → guilds/{id}/channels with Bot    → 401 ✗
  discord    → guilds/{id}/channels with Bearer → 401 ✗
  discord    → guilds/{id}/channels with Bot    → 401 ✗
```

### Why It Fails

Both Composio connections use `auth_scheme: OAUTH2`. They provide **OAuth2 user tokens** — not actual Discord Bot tokens from the Developer Portal.

- `GET /users/@me/guilds` works with OAuth2 user tokens (requires `guilds` scope) — this is why server listing succeeds.
- `GET /guilds/{id}/channels` is a **Bot-only endpoint**. It requires the real Bot token (the one from Discord Developer Portal > Bot > Token). An OAuth2 user token with a "Bot" prefix is still an OAuth2 token and gets rejected.

**The Composio discordbot integration does NOT provide the actual bot token. It provides an OAuth2 token authorized through the bot's application, which is fundamentally different.**

### Solution

Store the actual Discord Bot token as a Supabase Edge Function secret and use it directly for the channels endpoint (and for activation/webhook setup which also needs bot auth).

**Changes required:**

1. **Add a `DISCORD_BOT_TOKEN` secret** in Supabase with the real bot token from Discord Developer Portal.

2. **Update `discord-automation-triggers` edge function** — for the `get-channels` action, use `DISCORD_BOT_TOKEN` directly with `Authorization: Bot ${token}` instead of going through Composio credentials. Keep the Composio OAuth flow for `get-servers` (which works via `users/@me/guilds`).

3. **Update the `activate` action** — the trigger setup via Composio should still work, but channel-level operations that hit Discord API directly should use the bot token.

### Technical Detail

```text
Current (broken):
  Composio OAuth2 token → "Bot <oauth_token>" → Discord channels API → 401

Proposed fix:
  DISCORD_BOT_TOKEN secret → "Bot <real_bot_token>" → Discord channels API → 200
```

The `get-servers` flow continues using Composio connections (OAuth2 token works for `users/@me/guilds`). Only channel listing and any other bot-privileged endpoints switch to the direct bot token.

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/discord-automation-triggers/index.ts` | Use `DISCORD_BOT_TOKEN` env var for channel listing instead of Composio credentials |

### Prerequisite
You need to add the `DISCORD_BOT_TOKEN` secret in the Supabase dashboard with the bot token from [Discord Developer Portal](https://discord.com/developers/applications) > your app > Bot > Reset Token.

