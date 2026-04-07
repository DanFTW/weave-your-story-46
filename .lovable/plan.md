

## Problem

When reconnecting Spotify, the OAuth flow auto-signs into the previous account because Spotify's authorization URL lacks the `show_dialog=true` parameter. Spotify requires this parameter to force the consent/account-selection screen. Composio's `force_reauth` flag alone does not guarantee Spotify adds it.

## Fix

**File: `supabase/functions/composio-connect/index.ts`**

After extracting the `redirectUrl` from Composio's response (line 516), append `show_dialog=true` to the URL when the toolkit is `spotify` and `forceReauth` is true:

```typescript
let finalRedirectUrl = redirectUrl;
if (toolkitLower === "spotify" && forceReauth && finalRedirectUrl) {
  const separator = finalRedirectUrl.includes("?") ? "&" : "?";
  finalRedirectUrl = `${finalRedirectUrl}${separator}show_dialog=true`;
}
```

Then return `finalRedirectUrl` instead of `redirectUrl` in the response on line 542.

One file, ~5 lines added. No other changes.

