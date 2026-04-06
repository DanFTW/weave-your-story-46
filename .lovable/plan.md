
Fix only the missing persistence step in the Spotify reconnect path so the newest Composio connected account ID is saved to `user_integrations` as soon as a reconnect starts.

What I found
- The reconnect path is:
  `SpotifyMusicFinderFlow.handleReconnect()` -> `useComposio.connect(..., true)` -> `composio-connect`
- `composio-connect` creates a new Composio connected account during OAuth initiation and returns the new `connectionId`.
- But unlike the older `composio-auth` function pattern, `composio-connect` does not write that new `connectionId` to `user_integrations` before redirecting.
- The Spotify Music Finder edge function reads `user_integrations.composio_connection_id` before calling Composio.
- So after reconnect, the app still uses the stale old `ca_...` value from the previous row until callback persistence catches up or fails, which matches the behavior you described.
- `composio-callback` does eventually upsert `composio_connection_id = connectionId`, but the missing write in `composio-connect` is the gap causing the stale-ID bug.

Conservative fix
1. Update only `supabase/functions/composio-connect/index.ts`
   - After OAuth link creation succeeds and `connectionId` is parsed
   - Upsert `user_integrations` with:
     - `user_id`
     - `integration_id: toolkitLower`
     - `composio_connection_id: connectionId`
     - `status: "pending"`
     - `updated_at`
   - Use the existing unique key `onConflict: "user_id,integration_id"`

2. Use service-role DB access in that function for the upsert
   - `composio-connect` currently authenticates the user with anon auth only
   - Add a Supabase admin client in this function using `SUPABASE_SERVICE_ROLE_KEY`
   - Reuse it only for this single upsert
   - No schema changes needed

3. Keep all other reconnect behavior unchanged
   - Do not alter `SpotifyMusicFinderFlow`
   - Do not alter `useComposio`
   - Do not alter `spotify-music-finder`
   - Do not change callback logic beyond relying on the existing final upsert in `composio-callback`

Why this is the right single fix
- It matches the proven pattern already used in `composio-auth`, where the freshly created connection ID is saved immediately after initiation.
- It directly addresses the stale `user_integrations.composio_connection_id` problem you observed.
- It is minimal and low-risk: one function, one added persistence step, no UI or schema changes.

Files to touch
- `supabase/functions/composio-connect/index.ts`

Expected result
- Each Spotify reconnect writes the newly created `ca_...` ID into `user_integrations` right away.
- The subsequent playlist fetch reads the latest connection ID instead of the stale one.
- Reconnect should stop failing solely because the old Composio connected account ID remained in the database.

Technical note
```text
Current:
reconnect -> composio-connect creates new ca_new -> redirect
DB still has ca_old
spotify-music-finder reads ca_old -> Composio rejects -> spotify_reauth_required

After fix:
reconnect -> composio-connect creates new ca_new -> upsert DB with ca_new + pending -> redirect
spotify-music-finder reads ca_new
composio-callback later finalizes same row as connected
```
