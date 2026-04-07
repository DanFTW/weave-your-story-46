

## Fix: Double OAuth Race Condition in Spotify Music Finder

### Root Cause

When the user clicks "Reconnect Spotify", `handleReconnect` calls `disconnect()` then waits 500ms before calling `connect()`. During that gap, `isConnected` becomes `false` while `connecting` is still `false`. This triggers the navigation effect (line 41-53) which redirects to `/integration/spotify`, where IntegrationDetail initiates a **second** OAuth flow with `forceReauth: false`.

The second connection overwrites the first in `user_integrations`, but since it used `forceReauth: false`, it may reuse a stale/cached Spotify session without proper scopes — causing `list-playlists` to immediately fail with `spotify_reauth_required`.

### Console Evidence

```text
14:35:45 - Initiating spotify OAuth (forceReauth: true)    ← handleReconnect
14:35:53 - Initiating spotify OAuth (forceReauth: false)   ← unintended redirect to IntegrationDetail
14:36:03 - Connection detected via polling                 ← second (bad) connection wins
14:36:14 - loadPlaylists: errorCode: spotify_reauth_required
```

### Fix

**`src/components/flows/spotify-music-finder/SpotifyMusicFinderFlow.tsx`** — single change

Add `isReconnecting` to the navigation guard in the second `useEffect` so the effect does not redirect to `/integration/spotify` while a reconnection is in progress:

```ts
} else if (!isCheckingAuth && !isConnected && !connecting && !isReconnecting) {
```

This prevents the double OAuth entirely. Only the `forceReauth: true` connection from `handleReconnect` will proceed, and the resulting Composio connection will have the correct scopes and fresh token.

No other files are changed.

