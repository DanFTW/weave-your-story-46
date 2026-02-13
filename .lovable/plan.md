# Add Regular Discord Integration

## Problem

The existing Discord integration was renamed to "Discord Bot" (`/integration/discordbot`), but no regular Discord user integration exists yet. Additionally, the rename broke the backend -- `composio-connect` still has the auth config keyed as `discord`, but the frontend now sends `DISCORDBOT` as the toolkit.

## Scope

1. Fix the broken `discordbot` backend mapping
2. Add a new regular `discord` integration with auth config `ac_BOCrE-Q-yqJu`
3. Reuse the existing `fetchDiscordProfile` function, but make it **Composio-first** and only fall back to Discord API (`/users/@me`) if Composio profile fields are missing.

## Files to Edit (4 files)

### 1. `src/data/integrations.ts`

- Add a new `discord` entry in the integrations list (right next to `discordbot`):
  - `id: "discord"`, `name: "Discord"`, `icon: "discord"`, `status: "unconfigured"`
- Add a new `discord` key in `integrationDetails` with:
  - Description: "Discord allows Weave to access your profile, servers, and activity. Create memories from your conversations and community interactions."
  - Capabilities: "View profile", "Access servers", "Read messages", "View activity"
  - Gradient colors: same blurple palette as discordbot (`#5865F2`, `#4752C4`, `#7289DA`)

### 2. `src/components/integrations/IntegrationSection.tsx`

- Add `"discord"` to the `availableIntegrations` array (alongside existing `"discordbot"`)

### 3. `supabase/functions/composio-connect/index.ts`

- Rename `discord` -> `discordbot` in `AUTH_CONFIGS` (value stays `ac_jECZy5E0ycKY`)
- Add `discord: "ac_BOCrE-Q-yqJu"` for the regular Discord integration
- Add `"discordbot"` to `VALID_TOOLKITS` array (alongside existing `"discord"`)

### 4. `supabase/functions/composio-callback/index.ts`

Two changes:

**APP_TO_TOOLKIT mapping** (lines ~56-57): Update to distinguish bot from regular:

- `"discord"` -> `"discord"` (regular -- keep as-is)
- `"discord_bot"` -> `"discordbot"` (was mapping to `"discord"`, now maps to the renamed bot ID)
- Add `"discordbot"` -> `"discordbot"`

**Callback handler** (~line 2398): Add a second block for `toolkit === "discordbot"` that uses the same `fetchDiscordProfile` function, so the bot integration also populates the account card correctly. The existing `toolkit === "discord"` block handles the new regular integration.

## No New Files

- The existing `discord.svg` (official Discord Clyde logo, `#5865F2`) is shared by both integrations via the `icon: "discord"` property
- The existing `fetchDiscordProfile` function fetches username, email, and avatar via **Composio connection metadata first**, with a fallback to Discord API `/users/@me` only if needed -- works for both OAuth types
- No new components needed; `IntegrationDetail` page and `useComposio` hook work generically

## Technical Details

### Auth Flow

```text
User visits /integration/discord
  -> useComposio("discord") sends toolkit="DISCORD" to composio-connect
  -> Edge function lowercases to "discord", finds auth config ac_BOCrE-Q-yqJu
  -> Composio OAuth redirect -> user authorizes
  -> composio-callback resolves toolkit="discord" via APP_TO_TOOLKIT
  -> fetchDiscordProfile(connection/accessToken) gets username, email, avatar (Composio-first)
  -> Upserts user_integrations with integration_id="discord"
  -> Polling detects connected status, account card populates

```

### Profile Data Mapping

The `fetchDiscordProfile` function (updated to be Composio-first) maps:

- `global_name` or `username` -> `account_name`
- `email` -> `account_email` (may be null if not granted by scope)
- Avatar CDN URL (`cdn.discordapp.com/avatars/{id}/{hash}.png`) -> `account_avatar_url`