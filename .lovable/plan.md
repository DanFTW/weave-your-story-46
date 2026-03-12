

## Investigation: Why Instagram Memories Are Not Being Generated

### Finding 1: Posts — All 21 Are Skipped as Duplicates

The logs show:
```
[orchestrate] 21 previously synced items
[orchestrate] Normalized 21 posts
[orchestrate] Done — posts: {"fetched":21,"saved":0,"skipped":21,"failed":0}
```

All 21 posts were synced **before** the recent refactor (they exist in `instagram_synced_posts`). The dedupe logic correctly skips them. But the memories created by the **old** sync format were likely low quality or fragmented. The new improved `formatPostMemory` format has never actually been used because there are no new posts to process.

**Root cause**: The user needs to **force-reset** sync state to re-process all 21 posts with the new canonical memory format. The existing `force-reset-sync` action already supports this — it clears `instagram_synced_posts` and `instagram_synced_post_content`, allowing a fresh sync.

### Finding 2: Stories — Composio Tool Does Not Exist

The logs show:
```
[fetch] Stories error: 404 {"error":{"message":"Tool INSTAGRAM_GET_IG_USER_STORIES not found"}}
```

The tool `INSTAGRAM_GET_IG_USER_STORIES` is not available in Composio's toolkit. The same pattern appears for `INSTAGRAM_GET_IG_MEDIA_COMMENTS` in the automation poll logs — these tools simply don't exist in the current Composio Instagram integration.

**Root cause**: Composio's Instagram integration doesn't expose a stories endpoint. Story sync cannot work until Composio adds this tool or we use a different API path.

### Finding 3: Comments Also Fail

The automation poll logs show every comment fetch also 404s:
```
Error fetching comments: 404 {"error":{"message":"Tool INSTAGRAM_GET_IG_MEDIA_COMMENTS not found"}}
```

So comments sync is also non-functional via Composio.

### Recommended Plan

| Issue | Fix |
|-------|-----|
| **Posts not re-syncing with new format** | After force-reset, re-sync will create proper canonical memories. No code change needed — user just needs to use the existing "Reset" button. |
| **Stories 404** | Change `fetchInstagramStories` to gracefully handle the missing tool — log a warning and return empty instead of treating it as an error. Optionally disable the Stories toggle or show a "coming soon" indicator until Composio supports it. |
| **Comments 404** | Same graceful handling — the `instagram-automation-poll` function should also handle this cleanly. |
| **Sync result toast says "0 items"** | This is correct behavior when all items are deduped. After a force-reset it will show the real count. |

### Minimal Code Changes

1. **`supabase/functions/instagram-sync/index.ts`**: In `fetchInstagramStories`, detect the 404 "Tool not found" response and return `{ items: [], error: undefined }` (silent skip) instead of propagating an error. Add a log like `[fetch] Stories API not available — skipping`.

2. Same treatment for `fetchPostComments` — already returns empty on error, but should not log as error when the tool simply doesn't exist (log as info/warn instead).

3. No UI changes needed — the Stories toggle can stay. When the tool becomes available, it will just work.

This is a 2-line logic change in the edge function plus a user-initiated force-reset to re-sync posts with the improved memory format.

