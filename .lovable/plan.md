
Fix the Spotify playlist loading by tracing and tightening the exact path where the data is being collapsed to an empty array.

What I found
- The frontend is not the place where playlists are lost. `useSpotifyMusicFinder.loadPlaylists()` calls the edge function and only shows “No playlists found” because the edge function returns `{ playlists: [] }`.
- The silent failure is in `supabase/functions/spotify-music-finder/index.ts`.
- `composioExecute()` only treats non-2xx HTTP responses as errors. But elsewhere in this codebase, Composio often returns `200` with `successful: false`, `error`, or nested data shapes.
- The current Spotify parser is still too shallow. It checks:
  - `result.data.response_data`
  - `result.response_data`
  - `result.data`
  - `result`
  and then assumes `items` is directly on that object.
- Existing Composio parsers in this repo already handle deeper shapes like `response_data.data.items`. The Spotify function does not.
- So the real code-level root cause is: the edge function is masking the raw Composio result and collapsing both “deeper nested success payload” and “provider returned an error inside 200” into `playlists: []`.

Most likely underlying provider issue
- If the raw payload is not just deeper nesting, the next most likely cause is Spotify scope mismatch on the custom auth config (`ac_VEoX-dA2CYrF`), especially for `playlist-read-private`. That would also be silent today because the helper never surfaces provider-level errors from 200 responses.

Implementation plan
1. Add end-to-end logging only in the Spotify Music Finder path
   - `src/hooks/useSpotifyMusicFinder.ts`
     - log when playlist load starts
     - log the exact edge-function response shape and playlist count
     - log returned error payloads when present
   - `supabase/functions/spotify-music-finder/index.ts`
     - log request entry for `list-playlists`
     - log whether Spotify integration row and connection ID were found
     - in `composioExecute`, log:
       - action name
       - HTTP status
       - first chunk of raw response
       - parsed top-level keys
       - `successful`, `status`, `execution_status`, and `error` if present

2. Stop treating “200 but provider failed” as success
   - Update `composioExecute()` to detect Composio/provider failure markers like:
     - `successful === false`
     - `data.successful === false`
     - `error`
     - `data.error`
   - Throw a real error instead of returning a payload that later becomes `[]`.

3. Replace the Spotify playlist parser with the repo’s more robust pattern
   - Search these candidate paths for playlist items:
     - `result.data.response_data.items`
     - `result.data.response_data.data.items`
     - `result.response_data.items`
     - `result.response_data.data.items`
     - `result.data.items`
     - `result.data.data.items`
     - `result.items`
   - Log which path matched and how many items were found.
   - Apply the same parser hardening to the related Spotify search / playlist-items reads in this function, because they currently have the same shallow parsing weakness.

4. Surface the real failure back to the frontend
   - If Composio returns a provider error, return a descriptive edge-function error instead of `playlists: []`.
   - Frontend should show a destructive toast for real provider/auth failures, not the empty-state copy.

5. If logs confirm scope mismatch, fix the auth path directly
   - Keep the parser/error-handling fixes above.
   - Then update the Spotify connection flow so missing scopes are explicit.
   - Required Spotify scopes to verify for this thread:
     - `playlist-read-private`
     - `playlist-read-collaborative`
     - `playlist-modify-public`
     - `playlist-modify-private`
   - Existing Spotify connections would need re-authorization after scope changes.

Files to touch
- `src/hooks/useSpotifyMusicFinder.ts`
- `supabase/functions/spotify-music-finder/index.ts`
- Only if needed for clearer diagnostics: `src/components/flows/spotify-music-finder/SpotifyMusicFinderConfig.tsx`

Technical details
```text
Frontend
  loadPlaylists()
    -> invoke("spotify-music-finder", { action: "list-playlists" })
      -> edge function list-playlists
        -> lookup user_integrations.spotify
        -> composioExecute(SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS)
        -> raw Composio payload
        -> parser currently collapses non-matching payloads/errors to items=[]
        -> returns { playlists: [] }
      -> UI renders "No playlists found"
```

Expected outcome after the fix
- We will know exactly which of these is happening:
  1. playlists exist but are under a deeper nested path
  2. Composio is returning a provider error inside a 200 payload
  3. Spotify auth is missing required scopes
- And the UI will stop silently converting that into “No playlists found.”
