

## Root Cause Analysis

Three interconnected bugs traced to the edge function:

1. **Liked videos 404**: `YOUTUBE_LIST_PLAYLIST_ITEMS` doesn't exist in Composio (returns 404 "Tool not found"). The available tool is `YOUTUBE_GET_CHANNEL_ACTIVITIES`.

2. **Duplication / count inflation**: Memory creation fails (LIAM API returns 502 Bad Gateway), and records are only inserted to `youtube_synced_posts` inside the `if (success)` block (line 432). Since no records are inserted, the dedup Set is empty on next sync → same 20 subscriptions pass the filter every time. Meanwhile, `videos_synced_count` (line 456) adds `videosToSync.length` regardless of actual success → count grows by 20 each sync.

3. **No history entries**: Same cause — records never inserted because they're gated on memory creation success.

## Plan — 1 file: `supabase/functions/youtube-sync/index.ts`

### Fix 1: Liked video fetching

Replace `YOUTUBE_LIST_PLAYLIST_ITEMS` call in `fetchLikedVideos` with `YOUTUBE_GET_CHANNEL_ACTIVITIES`. Parse the response for activities containing video uploads and likes. The tool exists and was used successfully before.

Restore `parseChannelActivitiesResponse` to extract videos from activities, looking for `contentDetails.upload.videoId` and `contentDetails.like.resourceId.videoId`.

### Fix 2: Decouple record insertion from memory creation

In `syncYouTubeContent` (lines 426-446), restructure the loop:
1. **Insert record first** via upsert (the unique constraint `(user_id, youtube_video_id)` already exists)
2. **Then attempt** memory creation
3. Track `recordsInserted` and `memoriesCreated` separately

```
for video in videosToSync:
  // Insert/upsert record FIRST — this enables dedup and history
  upsert into youtube_synced_posts 
    with onConflict: 'user_id,youtube_video_id', ignoreDuplicates: true
  
  // Then attempt memory creation (non-blocking for record)
  if (upsert succeeded as new row):
    recordsInserted++
    if createMemory succeeds:
      memoriesCreated++
```

### Fix 3: Fix count tracking

Line 456 currently uses `videosToSync.length`. Change to use `recordsInserted` (actual new records) for `videos_synced_count` and actual `memoriesCreated` for `memories_created_count`.

### Fix 4: Add retry resilience for memory creation

Add sequential processing with a small delay between LIAM API calls to avoid overwhelming the API (the 502 errors suggest rate limiting or connection flooding from 20 parallel-ish requests).

### Summary of changes

| Location | Change |
|----------|--------|
| `fetchLikedVideos` (~183-218) | Replace `YOUTUBE_LIST_PLAYLIST_ITEMS` with `YOUTUBE_GET_CHANNEL_ACTIVITIES` |
| `parsePlaylistItemsResponse` (~221-277) | Replace with `parseChannelActivitiesResponse` that extracts videos from activity items |
| `syncYouTubeContent` loop (~426-446) | Insert record via upsert BEFORE memory creation; track counts accurately |
| `syncYouTubeContent` counts (~450-459) | Use actual `recordsInserted` instead of `videosToSync.length` |

