## Improve Instagram Sync: Better Post Memories + Story Sync

### Summary

Refactor the `instagram-sync` edge function into composable helpers, improve post memory quality to one canonical memory per post, and add story sync via `INSTAGRAM_GET_IG_USER_STORIES`. Add a "Sync Stories" toggle to the config UI.

### 1. Database Migration

Add `sync_stories` column to `instagram_sync_config`:

```sql
ALTER TABLE instagram_sync_config
  ADD COLUMN IF NOT EXISTS sync_stories boolean NOT NULL DEFAULT true;

```

No new tables needed -- stories reuse `instagram_synced_posts` for dedupe (story IDs prefixed with `story_`) and `instagram_synced_post_content` for local storage (`media_type = 'STORY'`).

### 2. Edge Function: `supabase/functions/instagram-sync/index.ts`

Refactor into clearly separated helpers. The file stays as one `index.ts` but with distinct sections:

**Fetch helpers** (unchanged for posts, new for stories):

- `fetchInstagramPosts()` -- existing, no change
- `fetchInstagramStories(connectionId)` -- new, calls `INSTAGRAM_GET_IG_USER_STORIES` via Composio

**Normalize helpers** (decouple Composio response shapes from internal types):

- `normalizePost(raw: any): NormalizedItem | null` -- maps API fields to internal shape, skips unusable items (no id)
- `normalizeStory(raw: any): NormalizedItem | null` -- same pattern for stories

**Transform helpers** (format into memory content):

- `formatPostMemory(item: NormalizedItem): string` -- one canonical memory string per post. Concise, searchable. Handles IMAGE, VIDEO, CAROUSEL_ALBUM, captionless posts. Format:
  ```
  Instagram Post by @username | Jan 15, 2025
  Caption: "actual caption text"
  Type: Image | 12 likes, 3 comments
  [media:url] [link:permalink]

  ```
- `formatStoryMemory(item: NormalizedItem): string` -- similar but for stories:
  ```
  Instagram Story by @username | Jan 15, 2025
  Type: Image
  [media:url]

  ```
- `formatCommentMemory()` -- existing, minor cleanup

**Persist helpers**:

- `isDuplicate(syncedIds: Set<string>, externalId: string): boolean`
- `persistSyncRecord(supabase, userId, externalId)` -- insert into `instagram_synced_posts`
- `persistLocalContent(supabase, userId, item: NormalizedItem)` -- upsert into `instagram_synced_post_content`

**Orchestrator** -- replaces the monolithic `syncInstagramContent`:

- `syncInstagramContent()` reads config toggles (`sync_posts`, `sync_comments`, `sync_stories`)
- Calls fetch → normalize → filter dupes → transform → createMemory → persist for each content type independently
- Tracks per-run counts: `{ fetched, saved, skipped, failed }` per content type
- Item-level try/catch so one failure doesn't stop the batch
- Logs at each stage: fetch count, transform count, dedupe count, persist count

**New action** in the switch statement:

- No new actions needed -- existing `sync` action will now also process stories based on config toggle

### 3. Types: `src/types/instagramSync.ts`

Add `syncStories` to `InstagramSyncConfig`:

```typescript
export interface InstagramSyncConfig {
  // ... existing fields
  syncStories: boolean;
}

```

Add `storiesSynced` to `InstagramSyncResult`:

```typescript
export interface InstagramSyncResult {
  // ... existing fields
  storiesSynced: number;
}

```

### 4. Hook: `src/hooks/useInstagramSync.ts`

- Map `sync_stories` from the DB row to `syncStories` in the config object (lines ~59-70)
- Include `sync_stories` in `saveConfig` update data (lines ~100-105)
- Map `storiesSynced` from the sync response in `syncNow` (lines ~186-192)

### 5. Config UI: `src/components/flows/instagram-sync/InstagramSyncConfig.tsx`

Add a third toggle row for "Sync Stories" between Sync Comments and the Professional Account note. Use a `Clock` or `Film` icon. Same pattern as existing toggles.

The props interface adds `syncStories: boolean`. The `onSave` config shape adds `syncStories`.

Update the disabled check: `(!syncPosts && !syncComments && !syncStories)`.

### 6. Active UI: `src/components/flows/instagram-sync/InstagramSyncActive.tsx`

Add a "Sync Stories" row to the Current Settings summary section, same pattern as Sync Posts / Sync Comments.

### 7. Flow: `src/components/flows/instagram-sync/InstagramSyncFlow.tsx`

Pass `syncStories` through to `InstagramSyncConfig` and include it in `handleSaveConfig`.

### Files Changed


| File                                                          | Change                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/functions/instagram-sync/index.ts`                  | Refactor into helpers, improve post format, add story fetch/sync |
| `src/types/instagramSync.ts`                                  | Add `syncStories`, `storiesSynced`                               |
| `src/hooks/useInstagramSync.ts`                               | Map new fields                                                   |
| `src/components/flows/instagram-sync/InstagramSyncConfig.tsx` | Add Stories toggle                                               |
| `src/components/flows/instagram-sync/InstagramSyncActive.tsx` | Show Stories setting                                             |
| `src/components/flows/instagram-sync/InstagramSyncFlow.tsx`   | Pass `syncStories` through                                       |
| DB migration                                                  | Add `sync_stories` column                                        |
