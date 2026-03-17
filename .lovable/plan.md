

## Problem

Liked Videos never sync because `fetchLikedVideos` uses `YOUTUBE_GET_CHANNEL_ACTIVITIES`, which doesn't expose likes. The YouTube Data API exposes liked videos through a special playlist with ID `"LL"` (the user's "Liked videos" playlist). We need to fetch items from that playlist instead.

## Plan — 1 file: `supabase/functions/youtube-sync/index.ts`

### Replace `fetchLikedVideos` implementation

Instead of using `YOUTUBE_GET_CHANNEL_ACTIVITIES` → channel activities, use a two-step approach:

1. **Fetch the "LL" playlist items** via `YOUTUBE_LIST_PLAYLIST_ITEMS` (Composio tool) with `playlistId: "LL"` and `part: "snippet,contentDetails"`. This returns the user's liked videos directly.

2. **Parse the response** into `YouTubeVideo[]` objects, extracting `contentDetails.videoId`, `snippet.title`, `snippet.channelTitle`, etc.

### Specific changes

- **Replace `fetchLikedVideos` function** (~lines 183-225): Remove the channel ID lookup + activities fetch. Replace with a single call to `YOUTUBE_LIST_PLAYLIST_ITEMS` using `playlistId: "LL"`.

- **Replace `parseChannelActivitiesResponse`** (~lines 228-312): Replace with a simpler `parsePlaylistItemsResponse` that extracts video data from playlist item structure (`snippet.resourceId.videoId`, `snippet.title`, etc.).

- **`list-videos` action** (line 73): Will automatically use the new `fetchLikedVideos` — no change needed.

- **`formatVideoAsMemory`** (line 521): Update the label from hardcoded "Liked on" to be category-aware (subscription vs liked video).

- **Keep `getYouTubeChannelId` function** as-is (may be useful for other features, but won't be called for liked videos anymore).

- **No changes** to subscription logic, watch history, or any other files.

### Category mapping

Videos fetched from the LL playlist get `video_category = 'Liked Video'` (already handled by the existing `video.id.startsWith('sub_')` check in the insert logic — liked video IDs are plain video IDs, not prefixed with `sub_`).

