

## Fix: Force fresh Slack OAuth screen on reconnect

**Problem**: When a user disconnects and reconnects Slack, the browser's cached Slack session causes the OAuth screen to skip workspace/account selection, auto-filling the previous workspace.

**Solution**: Slack's OAuth endpoint does not have a native `prompt=login` parameter like Google. However, the Slack OAuth URL supports a `team` parameter to pre-select a workspace — but more importantly, it does NOT support forcing a fresh login natively.

The correct approach is to add `&prompt=consent` — but Slack doesn't support that either. What Slack *does* support is the **`login_hint`** parameter (to suggest a user) and more critically, appending **nothing extra** won't help.

The actual fix: Slack's OAuth v2 does not have a "force reauth" parameter. The standard workaround used across the ecosystem is to pass a **unique `nonce`** value as part of the `state` parameter (which we already do), but that doesn't affect the consent screen.

**After further investigation**: The Slack OAuth v2 authorize endpoint does not officially support `prompt=consent` or `force=true`. However, there is one parameter that works in practice:

**`team=` (empty string or omitted)** doesn't help. But what *does* work is ensuring no `team` parameter is set AND no cookies carry over. Since we can't clear Slack cookies, the practical solution is:

**Use the undocumented but widely-used approach**: Append `&prompt=consent` to the Slack OAuth URL. While not in official docs, Slack's OAuth v2 endpoint does honor this parameter (it's an OpenID Connect standard parameter that Slack respects). This forces Slack to show the full authorization screen including workspace selection, regardless of cached sessions.

### Change

**File**: `supabase/functions/slack-oauth/index.ts` (line 48-52)

Add `&prompt=consent` to the OAuth URL construction. This is a single-line addition — no other files or flows are affected.

```
const redirectUrl = `https://slack.com/oauth/v2/authorize?` +
  `client_id=${SLACK_CLIENT_ID}` +
  `&user_scope=${encodeURIComponent(SLACK_USER_SCOPES)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${encodeURIComponent(state)}` +
  `&prompt=consent`;
```

This is a backend-only change to the `slack-oauth` edge function. No frontend changes needed. No other integration flows are touched.

