
Investigation summary

Workflow traced
`SpotifyMusicFinderFlow.handleReconnect`
→ `useComposio.connect(..., true)`
→ `composio-connect`
→ Composio OAuth
→ `OAuthComplete`
→ `composio-callback`
→ `user_integrations`
→ `spotify-music-finder` `list-playlists`

What the evidence shows
- `composio-disconnect` is succeeding and clearing the old Spotify row.
- `composio-connect` is now saving the new connected account ID immediately.
  - Edge logs show fresh saves like `ca_Qonmj76BvtxL` and `ca_C4lAzCLW5Ca7`.
- `composio-callback` is finalizing that same new ID as `status: "connected"`.
- `spotify-music-finder` is reading the new ID, not the stale one.
  - Example log: `list-playlists: connectionId=ca_C4lAzCLW5Ca7`.
- The failure happens after that, inside the Spotify provider call:
  - `403 ... Check settings on https://developer.spotify.com/dashboard, the user may not be registered.`

Root cause
The stale `ca_...` persistence bug does not appear to be the active problem anymore. The reconnect flow is completing, the newest connected account is being stored, and the playlist edge function is using it correctly.

The current root cause is most likely the Spotify auth configuration behind `ac_VEoX-dA2CYrF`, not the reconnect code.

Why this points to auth config / provider setup
- Multiple brand-new connected accounts fail the same way, which rules out “old ID still being read” as the main issue.
- The callback logs show the granted Spotify scopes are:
  `app-remote-control streaming user-modify-playback-state user-read-playback-state user-read-currently-playing user-read-email user-read-private`
- Those scopes do not include the playlist scopes this flow needs for playlist listing and track insertion, such as:
  `playlist-read-private`, `playlist-read-collaborative`, and likely `playlist-modify-private` / `playlist-modify-public`.
- The provider error text also specifically points to Spotify app registration / development-mode restrictions.

Initial solution
1. Do not change the reconnect persistence path again; it looks correct now.
2. Fix the Spotify auth config / underlying Spotify app:
   - Update Composio auth config `ac_VEoX-dA2CYrF` to request the missing playlist scopes.
   - In Spotify Developer Dashboard, make sure the authenticating user is added in User Management if the app is still in development mode, or move the app out of development mode.
3. Reconnect Spotify once after those external settings are fixed so a fresh token is issued.
4. Retest `/flow/spotify-music-finder`.

Recommended code follow-up after that
- Only if needed, make a small diagnostic UX change: stop classifying this exact provider 403 as generic `spotify_reauth_required`, since reconnect alone cannot fix a dashboard/scope misconfiguration.

Technical note
```text
new ca_* created
-> saved to user_integrations
-> callback marks it connected
-> spotify-music-finder reads that same new ca_*
-> Spotify provider returns 403

So the break is after connection persistence, not before it.
```
