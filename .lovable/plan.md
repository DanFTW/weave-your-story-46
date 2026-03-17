

## Problem

`PagePostCard.tsx` displays `Post ID: {post.facebookPostId}` because the `SyncedPagePost` type lacks `postMessage`, and `useFacebookPagePosts.ts` doesn't map `post_message` from the `facebook_synced_posts` table — even though that column exists and is populated by the edge function.

## Plan

### 1. `src/types/facebookPagePosts.ts` — add `postMessage` field
Add `postMessage: string | null` to the `SyncedPagePost` interface.

### 2. `src/hooks/useFacebookPagePosts.ts` — map `post_message` from DB
In the `loadSyncedPosts` mapping (line 38-43), add `postMessage: p.post_message`.

### 3. `src/components/flows/facebook-page-posts/PagePostCard.tsx` — show post content
Replace `Post ID: {post.facebookPostId}` with the actual `post.postMessage` text (falling back to `Post ID: ...` if message is null). Show the synced timestamp below.

### Files changed (3, all directly related)
- `src/types/facebookPagePosts.ts`
- `src/hooks/useFacebookPagePosts.ts`
- `src/components/flows/facebook-page-posts/PagePostCard.tsx`

