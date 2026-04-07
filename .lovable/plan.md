

## Problem

The current fix appends `show_dialog=true` to the `connect.composio.dev` intermediary URL (line 519-522 of `composio-connect/index.ts`). This is ineffective — that URL is Composio's session proxy, not Spotify's authorization endpoint. The parameter never reaches Spotify.

Composio's `/link` API does not expose a way to pass provider-specific OAuth params like `show_dialog`. The `connection_data` field is for service config (subdomain, shop, etc.), not OAuth authorization parameters. And `force_reauth: true` alone doesn't guarantee Spotify shows its account selection screen — Spotify requires the explicit `show_dialog=true` query parameter on its own `/authorize` endpoint.

## Approach: Resolve the redirect in the edge function

The `connect.composio.dev` session URL redirects (via 302) to the actual Spotify authorization URL. The edge function can follow this redirect chain server-side, extract the final Spotify URL, append `show_dialog=true`, and return the modified URL to the frontend.

## Plan

**File: `supabase/functions/composio-connect/index.ts`**

Replace the current ineffective `show_dialog` append (lines 518-522) with redirect resolution logic:

1. When `toolkitLower === "spotify"` and `forceReauth` is true and `redirectUrl` exists:
   - Make a `fetch` to the `redirectUrl` with `redirect: "manual"` to capture the 302 response without following it
   - Extract the `Location` header — this is the actual Spotify `https://accounts.spotify.com/authorize?...` URL
   - Append `show_dialog=true` to that URL
   - Use the resolved Spotify URL as the final `redirectUrl` returned to the frontend
   - If the redirect resolution fails for any reason, fall back to the original Composio URL (graceful degradation)

2. Remove the current naive append that puts `show_dialog=true` on the Composio URL

```
// Pseudocode
if (toolkitLower === "spotify" && forceReauth && redirectUrl) {
  try {
    const res = await fetch(redirectUrl, { redirect: "manual" });
    const location = res.headers.get("location");
    if (location && location.includes("accounts.spotify.com")) {
      const sep = location.includes("?") ? "&" : "?";
      redirectUrl = `${location}${sep}show_dialog=true`;
    }
  } catch (e) {
    console.warn("Failed to resolve Spotify redirect, using original URL", e);
  }
}
```

### Why this works
- The edge function runs server-side (Deno), so there are no CORS restrictions on following the redirect
- Composio's session URLs are simple 302 redirects to the provider's auth page
- The frontend receives the actual Spotify URL with `show_dialog=true`, bypassing Composio's intermediary entirely for the redirect step
- The callback flow is unchanged — Spotify still redirects to the `callback_url` that Composio configured

### Risk mitigation
- If Composio changes their redirect behavior (e.g., multi-step redirects, JavaScript-based redirects), the `fetch(..., { redirect: "manual" })` will fail to find a Spotify URL, and the fallback returns the original Composio URL — no worse than today
- Edge function logs will capture warnings if resolution fails

### Files changed
- `supabase/functions/composio-connect/index.ts` — one block replaced (~15 lines)

