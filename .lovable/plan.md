

# Fix: Break the Spotify Reconnect Infinite Loop

## Problem

The screenshots show the exact loop:
1. Page loads → playlists fail to load (`spotify_reauth_required`)
2. The `useEffect` on lines 51-81 of `SpotifyMusicFinderFlow.tsx` auto-triggers `disconnect()` + `connect()` 
3. Composio redirects to Spotify OAuth → succeeds → redirects back to the page
4. Component remounts → `hasTriggeredRepairRef` resets to `false` → playlist fetch fails again → auto-repair triggers again → infinite loop

The `hasTriggeredRepairRef` guard doesn't survive the OAuth redirect because the component unmounts and remounts.

## Fix

**Remove the automatic repair effect entirely.** Replace it with an inline "needs reconnect" UI state that lets the user manually trigger reconnection.

### File 1: `src/components/flows/spotify-music-finder/SpotifyMusicFinderFlow.tsx`

- Delete the entire `useEffect` block (lines 51-81) that watches `playlistLoadErrorCode` and auto-triggers disconnect/connect
- Remove the `hasTriggeredRepairRef` and `isRepairingConnection` state since they only exist for the auto-repair
- Remove `isRepairingConnection` from the loading gate (line 91)
- Add a `handleReconnect` callback that does the disconnect + connect sequence, triggered only by a user button click
- When `playlistLoadErrorCode === "spotify_reauth_required"`, render a "needs-reconnect" UI instead of the config form — a card with the error message and a "Reconnect Spotify" button

### File 2: `src/components/flows/spotify-music-finder/SpotifyMusicFinderConfig.tsx`

No changes needed — the config component already handles the empty playlists state. The parent will simply not render it when `playlistLoadErrorCode` is set.

### Result

- No automatic reconnection on error
- User sees a clear error message: "Your Spotify connection needs to be refreshed"
- User clicks "Reconnect Spotify" to manually initiate the OAuth flow
- If the underlying Spotify issue persists, the user sees the error again without being trapped in a loop

