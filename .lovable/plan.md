

## Analysis: Spotify Auth State Bleed

### How it works today

Both `/integration/spotify` (IntegrationDetail) and `/flow/spotify-music-finder` (SpotifyMusicFinderFlow) call `useComposio("SPOTIFY")`, which reads/writes the **same** `user_integrations` row (`integration_id = 'spotify'`). They are tightly coupled through two mechanisms:

### Problem 1: Stale sessionStorage redirect

**SpotifyMusicFinderFlow lines 44-47**: When the thread flow detects Spotify is not connected, it sets `sessionStorage.returnAfterSpotifyConnect = "/flow/spotify-music-finder"` and navigates to `/integration/spotify`.

**IntegrationDetail lines 53-70**: When connection succeeds, it reads `returnAfterSpotifyConnect` from sessionStorage and auto-redirects to that path.

**The bleed**: If a user visits the thread flow (which sets the sessionStorage key), navigates away without connecting, and later goes to `/integration/spotify` independently to connect Spotify for general use, they get unexpectedly redirected to the thread flow. The sessionStorage key persists across the session and is never cleared unless the redirect fires.

### Problem 2: Reconnect on thread disconnects globally

**SpotifyMusicFinderFlow lines 52-59**: `handleReconnect` calls `disconnect()` then `connect()`. This deletes the `user_integrations` row entirely — the same row the integration page reads. If both pages were open, the integration page would show disconnected.

### Problem 3: Thread auto-redirect loop risk

**SpotifyMusicFinderFlow lines 41-48**: If `isConnected` is false and `connecting` is false, the thread immediately navigates away to `/integration/spotify`. There's no way for the user to stay on the thread page in a disconnected state — the thread has no standalone connect UI, it always delegates to the integration page.

### What's NOT a problem

Both pages *should* share the same Composio connection — there's only one Spotify OAuth token per user. The `user_integrations` row is the single source of truth for "is Spotify connected." That's correct. The issue is the **navigation coupling and side effects**, not the shared connection state.

### Plan

**File: `src/components/flows/spotify-music-finder/SpotifyMusicFinderFlow.tsx`**

1. **Clear sessionStorage on thread mount** — Add cleanup logic: when the thread flow component mounts, if the user is already connected, remove `returnAfterSpotifyConnect` so it can't leak into a future integration page visit.

2. **Clear sessionStorage on back navigation** — When the user clicks "Back" (handleBack), remove `returnAfterSpotifyConnect` to prevent stale redirects if they later visit the integration page.

3. **Guard the redirect with intent** — Before setting `returnAfterSpotifyConnect` and navigating to the integration page, set a second flag like `sessionStorage.spotifyConnectIntent = "music-finder"`. On IntegrationDetail, only honor the return redirect if the intent flag matches. This prevents accidental redirects when the user independently visits the integration page.

**File: `src/pages/IntegrationDetail.tsx`**

4. **Clear stale return keys on direct navigation** — If the user arrived at the integration page without an active intent flag (i.e., they navigated here directly from `/integrations`, not from a thread redirect), remove any `returnAfter*Connect` keys for that integration on mount. This prevents accumulated stale keys from prior thread visits.

### Summary

The fix is purely navigation hygiene — clear sessionStorage keys when they're no longer relevant, and add an intent guard so the integration page only auto-redirects when the user was explicitly sent there by a thread flow. No changes to the shared `user_integrations` row or Composio connection logic.

