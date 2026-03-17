

## Problem

Three issues on `/flow/youtube-sync`:

1. **Wrong filter tabs**: "Liked Videos" and "Watch History" tabs show but those categories never populate. Need only "All", "Subscriptions", "Playlists".
2. **Label**: "Videos Synced" should be "Items Synced".
3. **No playlist items syncing**: `fetchLikedVideos` calls `YOUTUBE_GET_CHANNEL_ACTIVITIES` which fails with `Missing fields: {'channelId'}` (confirmed in logs). Need to replace with playlist-based fetching.

## Plan — 2 files

### 1. `src/components/flows/youtube-sync/YouTubeSyncActive.tsx`

- **Filter tabs**: Replace `filterOptions` with only `All`, `Subscription`, `Playlist`. Remove "Liked Video" and "Watch History" entries.
- **categoryConfig**: Replace `"Liked Video"` and `"Watch History"` entries with `"Playlist"` (use `Play` icon, blue color).
- **Stats label**: Change "Videos Synced" to "Items Synced".
- **Settings summary**: Replace the `syncLikedVideos` badge with a "Playlists" badge (since `sync_liked_videos` config toggle now drives playlist sync). Remove the `syncWatchHistory` badge.

### 2. `supabase/functions/youtube-sync/index.ts`

- **Replace `fetchLikedVideos`** with `fetchPlaylistItems`:
  1. Call `YOUTUBE_LIST_PLAYLISTS` with `mine: true` to get user's playlists.
  2. For each playlist (up to 5), call `YOUTUBE_GET_PLAYLIST_ITEMS` (or the equivalent Composio tool) to fetch items.
  3. Parse items into `YouTubeVideo[]` with IDs prefixed `pl_` to distinguish from subscriptions.

- **Replace `parseChannelActivitiesResponse`** with `parsePlaylistsResponse` + `parsePlaylistItemsResponse` to handle the new response structures.

- **Update `syncYouTubeContent`** (line 390): Change the condition from `sync_liked_videos` to still use that config flag but call `fetchPlaylistItems` instead of `fetchLikedVideos`.

- **Update category mapping** (line 440): `pl_` prefix → `'Playlist'` category, `sub_` prefix → `'Subscription'`.

- **Update `formatVideoAsMemory`** (line 508): Add `Playlist` case alongside existing `Subscription` case. Label: "YouTube Playlist Item", action: "Added on".

- **Update `list-videos` action** (line 73): Call `fetchPlaylistItems` instead of `fetchLikedVideos`.

