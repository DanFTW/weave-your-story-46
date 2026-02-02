
# Fix Instagram Live Monitoring - Complete Root Cause Analysis

## Executive Summary

The Instagram automation IS working - posts are being stored locally and memories are being created. However, the stats counters (`posts_tracked`, etc.) are not incrementing correctly, giving the false impression that nothing is being tracked.

## Detailed Root Cause Analysis

### Evidence Summary

| Metric | Expected | Actual | Verdict |
|--------|----------|--------|---------|
| Cron job exists | Yes | Yes | OK |
| Posts stored in `instagram_synced_post_content` | 10+ | 11 | OK |
| Posts tracked in `instagram_processed_engagement` | 10+ | 10 | OK |
| Memories created via LIAM | Yes | Yes (logs confirm SUCCESS) | OK |
| `last_polled_at` updated | 20:35:14 | 20:35:14 | OK |
| `posts_tracked` counter | 10 | 0 | BUG |

### The Bug: Stats Not Incrementing

Looking at the code flow:

```text
Line 422: let postsTracked = config.posts_tracked || 0;  // Reads 0 from DB
Line 450: if (!existingPost && config.monitor_new_posts) {
Line 473:   postsTracked++;  // Should increment to 1, 2, 3...10
Line 524-532: await supabase.update({ posts_tracked: postsTracked })
```

The log shows `Cron poll: User X - 10 new items`, proving 10 posts were processed. The `last_polled_at` IS being updated, so the update query runs. But `posts_tracked` stays at 0.

**Root Cause Identified**: The variable `postsTracked` only increments when a post is NOT already in `instagram_processed_engagement`. But looking more carefully at the timeline:

- 20:35:05-13: Each post inserted into `instagram_processed_engagement` 
- The FIRST cron run should process all 10 posts (none exist yet)
- `postsTracked` should be 10

But the counter shows 0! This means:
1. The increment IS happening (logs show "10 new items")
2. The update IS running (last_polled_at changes)
3. But `posts_tracked` specifically isn't persisting

**Likely Cause**: The `config` passed to `processUserInstagram` may have `posts_tracked` as `null` instead of `0`, and the `|| 0` handles this. But when updating, if there's a type mismatch or the column expects an integer and receives something else, it might fail silently.

Actually - re-examining the update logic, I notice there's NO error handling on the update:

```typescript
await supabase.from("instagram_automation_config").update({...});
// No .then() or error check!
```

### Additional Issue: Deduplication Table Mismatch

Two separate deduplication systems:
- `instagram-sync` uses `instagram_synced_posts` table
- `instagram-automation-poll` uses `instagram_processed_engagement` table

This means posts synced manually will be re-processed by automation, potentially creating duplicate memories.

---

## Solution Plan

### Fix 1: Add Error Logging to Stats Update

Add proper error handling to debug and prevent silent failures:

```typescript
// Update stats with error handling
const { error: updateError } = await supabase
  .from("instagram_automation_config")
  .update({
    last_polled_at: new Date().toISOString(),
    posts_tracked: postsTracked,
    comments_tracked: commentsTracked,
    likes_tracked: likesTracked,
  })
  .eq("user_id", userId);

if (updateError) {
  console.error(`[Stats] Failed to update config for user ${userId}:`, updateError);
} else {
  console.log(`[Stats] Updated: posts=${postsTracked}, comments=${commentsTracked}, likes=${likesTracked}`);
}
```

### Fix 2: Use Unified Deduplication Table

Consolidate deduplication to use `instagram_synced_post_content` as the single source of truth:

```typescript
// Check if post already in local storage (unified deduplication)
const { data: existingPost } = await supabase
  .from("instagram_synced_post_content")
  .select("id")
  .eq("user_id", userId)
  .eq("instagram_post_id", post.id)
  .maybeSingle();

if (!existingPost && config.monitor_new_posts) {
  // Process new post...
}
```

This ensures:
- Posts synced via `instagram-sync` won't be re-processed by automation
- Single source of truth for what's been captured
- No duplicate memories

### Fix 3: Calculate Stats from Actual Data

Instead of relying on incrementing counters, calculate stats from actual table counts:

```typescript
// Get accurate counts from actual data
const { count: postsCount } = await supabase
  .from("instagram_synced_post_content")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId);

await supabase
  .from("instagram_automation_config")
  .update({
    last_polled_at: new Date().toISOString(),
    posts_tracked: postsCount || 0,
  })
  .eq("user_id", userId);
```

This ensures the counter always reflects reality.

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/instagram-automation-poll/index.ts` | Add error logging, unify deduplication, fix stats calculation |

---

## Technical Implementation Details

### Changes to `processUserInstagram` function:

1. **Replace deduplication check** - Use `instagram_synced_post_content` instead of `instagram_processed_engagement`

2. **Add logging for stats update** - Capture and log any errors from the update query

3. **Calculate stats from actual data** - Query the count of posts in `instagram_synced_post_content` for accurate stats

4. **Remove redundant `instagram_processed_engagement` inserts** - Since we're using `instagram_synced_post_content` for deduplication, we can skip the separate engagement table for posts (keep it for comments if needed)

### Sample Code Changes:

```typescript
// Before processing loop
const { data: existingPosts } = await supabase
  .from("instagram_synced_post_content")
  .select("instagram_post_id")
  .eq("user_id", userId);

const existingPostIds = new Set(existingPosts?.map(p => p.instagram_post_id) || []);

// In the loop
if (!existingPostIds.has(post.id) && config.monitor_new_posts) {
  // Store post locally (this is the deduplication)
  await storePostLocally(supabase, userId, post, mediaUrl);
  // ... create memory ...
  newItems++;
}

// After processing - get accurate count
const { count: totalPosts } = await supabase
  .from("instagram_synced_post_content")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId);

// Update with actual count
const { error: updateError } = await supabase
  .from("instagram_automation_config")
  .update({
    last_polled_at: new Date().toISOString(),
    posts_tracked: totalPosts || 0,
  })
  .eq("user_id", userId);

if (updateError) {
  console.error(`[Stats] Update failed:`, updateError);
}
```

---

## Expected Outcomes

After implementation:
1. Stats counters will accurately reflect the number of stored posts
2. No duplicate processing between manual sync and automation
3. Clear error logging for any database update failures
4. Single source of truth for Instagram content (`instagram_synced_post_content`)
5. UI will display accurate "Posts Tracked" count
