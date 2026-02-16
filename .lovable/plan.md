&nbsp;

---

# Fix: Discord Channel Listing Returns 401

## Root Cause

The `getDiscordCredentials()` function in `discord-automation-triggers/index.ts` has a flawed token type detection on **line 53**:

```typescript
const isBot = toolkitSlug === "discordbot" || tokenType === "Bot";

```

The Composio `discordbot` connection returns `token_type: "Bearer"` (an OAuth Bearer token), but the code overrides this to `Bot` based on the toolkit slug. This sends `Bot <oauth_bearer_token>` to Discord, which returns **401 Unauthorized** for every request.

Edge function logs confirm this:

- `ca_seifjoPKRVN6` (discordbot): `tokenType: Bearer` but resolved as `Bot`
- Both connections fail with 401, triggering the "reconnect" prompt

## Fix

**File:** `supabase/functions/discord-automation-triggers/index.ts`

Change line 53 to trust the `token_type` field from Composio metadata instead of inferring from the toolkit slug:

```typescript
// Before (broken):
const isBot = toolkitSlug === "discordbot" || tokenType === "Bot";

// After (fixed):
const isBot = tokenType === "Bot";

```

This ensures the Authorization header matches what Composio actually issued. If Composio says `Bearer`, we use `Bearer`. If it says `Bot`, we use `Bot`.

**Deploy:** Redeploy the `discord-automation-triggers` edge function.

## Files Modified


| File                                                      | Change                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `supabase/functions/discord-automation-triggers/index.ts` | Line 53: remove `toolkitSlug === "discordbot"` from `isBot` check |


No frontend changes needed.

**Suggestion:** the console `net::ERR_BLOCKED_BY_CLIENT` errors you screenshotted are from an ad/tracker blocker and are unrelated to the Discord channel listing failure.

**Suggestion:** if the channel listing endpoint still fails after this (because Discord may require a true Bot token for `/guilds/{guild_id}/channels`), add a single retry fallback: on 401, retry the same request once with the opposite scheme (`Bearer` ↔ `Bot`) **only for the** `discordbot` **connection**, then proceed. This makes the integration resilient to Composio reporting `token_type` inconsistently without adding user-visible delay in the success path.

**Suggestion:** ensure trigger creation uses the correct Composio trigger slug `DISCORD_NEW_MESSAGE_TRIGGER` wherever you create the polling trigger instance (this is separate from listing channels, but required for the tracker to actually run).

---

## Exact code change to apply (minimal)

### 1) Fix the token type detection (the plan’s fix)

In `supabase/functions/discord-automation-triggers/index.ts`, locate the line:

```ts
const isBot = toolkitSlug === "discordbot" || tokenType === "Bot";

```

Replace with:

```ts
const isBot = tokenType === "Bot";

```

That’s the exact change Lovable proposes.

---

## Recommended hardening change (still minimal, but makes it “just work”)

If you want this to survive Composio weirdness (token_type mismatch) and avoid your UI incorrectly forcing “Reconnect Discord”, do **this small addition**:

### 2) Add an optional override to `getDiscordCredentials()`

Find `getDiscordCredentials()` and adjust it to accept an optional override scheme.

Example pattern (drop-in style):

```ts
type DiscordAuthScheme = "Bot" | "Bearer";

function buildDiscordAuthHeader(scheme: DiscordAuthScheme, token: string) {
  return `${scheme} ${token}`;
}

// Change signature to accept override
async function getDiscordCredentials(connId: string, overrideScheme?: DiscordAuthScheme) {
  // ...existing lookup logic...
  const tokenType = metadata?.token_type ?? "Bearer";
  const accessToken = metadata?.access_token;

  // Lovable fix (trust token_type)
  const inferredScheme: DiscordAuthScheme = tokenType === "Bot" ? "Bot" : "Bearer";

  const schemeToUse = overrideScheme ?? inferredScheme;

  return {
    headers: {
      Authorization: buildDiscordAuthHeader(schemeToUse, accessToken),
    },
    scheme: schemeToUse,
    accessToken, // optional but helpful for debug
  };
}

```

### 3) In your `get-channels` handler, retry once on 401 with the opposite scheme

Where you fetch:

`https://discord.com/api/v10/guilds/${serverId}/channels`

Do:

- First attempt: `getDiscordCredentials(connId)` (normal)
- If response is 401: retry once using the opposite scheme **for that same connection**
- Only show “Reconnect Discord” after exhausting all connections *and* you’re still getting 401s

Pseudo-drop-in:

```ts
const url = `https://discord.com/api/v10/guilds/${serverId}/channels`;

for (const connId of connectionIdsToUse) {
  const cred1 = await getDiscordCredentials(connId);
  let res = await fetch(url, { headers: cred1.headers });

  if (res.status === 401) {
    const opposite = cred1.scheme === "Bot" ? "Bearer" : "Bot";
    const cred2 = await getDiscordCredentials(connId, opposite);
    res = await fetch(url, { headers: cred2.headers });
  }

  if (res.ok) {
    const channels = await res.json();
    const filtered = channels.filter((c: any) => c.type === 0 || c.type === 5);
    return json({ channels: filtered, requiresReconnect: false });
  }

  // Optional: treat 403 as permissions/bot-not-in-guild (NOT reconnect)
  if (res.status === 403) {
    continue; // try next connection
  }
}

// If we got here, everything failed
return json({ error: "All available Discord connections failed to list channels.", requiresReconnect: true }, 401);

```

---

## Trigger slug note (you asked explicitly)

Listing channels is step 2. After that, when you create the poll trigger, make sure the slug used is exactly:

`DISCORD_NEW_MESSAGE_TRIGGER`

Search for any older slug usage and replace only if needed.

---

If you paste the `getDiscordCredentials()` function body here (or the relevant section around line ~53), I’ll rewrite it **exactly** in your project’s current style so you can paste it in with zero guesswork.