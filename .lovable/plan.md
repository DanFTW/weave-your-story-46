

## Problem

The YouTube sync active monitoring page shows stats (25 videos synced, 20 memories created) but has no history section showing what was actually synced. The `youtube_synced_posts` table only stores `youtube_video_id` and `synced_at` — no title or category, so there's nothing meaningful to display.

## Plan — 3 files + 1 migration

### 1. Database migration: add `video_title` and `video_category` columns

```sql
ALTER TABLE youtube_synced_posts
  ADD COLUMN video_title text,
  ADD COLUMN video_category text;
```

Backfill existing rows: IDs prefixed with `sub_` are Subscriptions; the rest are Liked Videos (watch history isn't distinguishable, so default to "Liked Video").

```sql
UPDATE youtube_synced_posts
SET video_category = CASE
  WHEN youtube_video_id LIKE 'sub_%' THEN 'Subscription'
  ELSE 'Liked Video'
END
WHERE video_category IS NULL;
```

### 2. Edge function update: `supabase/functions/youtube-sync/index.ts`

In the `syncYouTubeContent` function (~line 469-474), update the insert to include the new columns:

```typescript
await supabase
  .from('youtube_synced_posts')
  .insert({
    user_id: userId,
    youtube_video_id: video.id,
    video_title: video.title,
    video_category: video.id.startsWith('sub_') ? 'Subscription' : 'Liked Video',
  });
```

### 3. Hook update: `src/hooks/useYouTubeSync.ts`

- Add a `syncHistory` state: `{ id: string; videoTitle: string | null; videoCategory: string | null; syncedAt: string }[]`.
- Add a `loadSyncHistory` function that queries `youtube_synced_posts` for the current user, ordered by `synced_at DESC`.
- Call `loadSyncHistory` inside `loadConfig` (when phase is active) and after `syncNow`.
- Expose `syncHistory` in the return value.

### 4. Component update: `src/components/flows/youtube-sync/YouTubeSyncActive.tsx`

- Accept `syncHistory` as a new prop.
- Add a collapsible "Sync History" section (following the Slack pattern with `Collapsible`) between the settings summary and the recent videos section.
- Each history item renders: video title (or video ID as fallback), a category badge (color-coded: red for Liked Video, purple for Subscription, orange for Watch History), and relative timestamp via `formatDistanceToNow`.

### Files modified

| File | Change |
|------|--------|
| Migration SQL | Add `video_title`, `video_category` columns + backfill |
| `supabase/functions/youtube-sync/index.ts` | Persist title & category on insert |
| `src/hooks/useYouTubeSync.ts` | Add `syncHistory` state + `loadSyncHistory` query |
| `src/components/flows/youtube-sync/YouTubeSyncActive.tsx` | Add collapsible history section with category badges |

