
# Fix Instagram Sync Consistency with Local Storage

## Root Cause Analysis

The Instagram sync logs show 11 posts successfully synced and 11 "Memory created successfully" messages. However, the LIAM Memory API is a **semantic search engine** that tokenizes and consolidates content into searchable facts rather than storing raw documents:

| What we sent | What LIAM stored |
|--------------|------------------|
| Full Instagram post with caption, likes, media URL | "Instagram post has a image and a link" |
| | "Instagram post has hashtag cac" |
| | "Price of terminal galaxy rainbow is $650 OBO" |
| | "Post received 12 likes and 2 comments" |

Multiple semantic facts share the same transaction ID prefix, meaning LIAM extracted multiple "facts" from each post, but the original complete content is lost for display purposes.

**This is identical to the Twitter Alpha Tracker issue we just solved.**

## Solution: Hybrid Local Storage (Proven Pattern)

Store complete Instagram post data in a local database table for reliable 1:1 display, while continuing to send to LIAM for semantic search capabilities.

---

## Implementation Plan

### 1. Database Migration: Create `instagram_synced_post_content` Table

A new table to store the full content of each synced post:

```sql
CREATE TABLE instagram_synced_post_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_post_id TEXT NOT NULL,
  caption TEXT,
  media_type TEXT,
  media_url TEXT,
  permalink_url TEXT,
  username TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  posted_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, instagram_post_id)
);

CREATE INDEX idx_instagram_content_user_synced 
  ON instagram_synced_post_content(user_id, synced_at DESC);

ALTER TABLE instagram_synced_post_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own Instagram posts"
  ON instagram_synced_post_content FOR SELECT
  USING (auth.uid() = user_id);
```

### 2. Update Edge Function: `supabase/functions/instagram-sync/index.ts`

Modify the sync logic to:
- Store complete post data in `instagram_synced_post_content` during sync
- Continue sending to LIAM API for semantic search (fire-and-forget)
- Add a `list-synced-posts` action to retrieve stored posts

Key changes:
```typescript
// After successful memory creation, store locally
await supabase.from('instagram_synced_post_content').upsert({
  user_id: userId,
  instagram_post_id: post.id,
  caption: post.caption,
  media_type: post.mediaType,
  media_url: imageUrl,
  permalink_url: post.permalinkUrl,
  username: post.username,
  likes_count: post.likesCount,
  comments_count: post.commentsCount,
  posted_at: post.timestamp,
});
```

Add new action handler:
```typescript
case 'list-synced-posts': {
  const { data: posts } = await supabase
    .from('instagram_synced_post_content')
    .select('*')
    .eq('user_id', userId)
    .order('posted_at', { ascending: false })
    .limit(100);
    
  return new Response(JSON.stringify({ posts }), { ... });
}
```

### 3. Create New Type: `InstagramStoredPost`

Add to `src/types/instagramSync.ts`:

```typescript
export interface InstagramStoredPost {
  id: string;
  user_id: string;
  instagram_post_id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  permalink_url: string | null;
  username: string | null;
  likes_count: number | null;
  comments_count: number | null;
  posted_at: string;
  synced_at: string;
}
```

### 4. Create Hook: `src/hooks/useInstagramPosts.ts`

New hook to fetch locally stored Instagram posts:

```typescript
export function useInstagramPosts() {
  const [posts, setPosts] = useState<InstagramStoredPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.functions.invoke('instagram-sync', {
      body: { action: 'list-synced-posts' },
    });
    if (data?.posts) setPosts(data.posts);
    setIsLoading(false);
  }, []);

  return { posts, isLoading, fetchPosts };
}
```

### 5. Update Memories Page: `src/pages/Memories.tsx`

Merge locally stored Instagram posts with LIAM memories (same pattern as Twitter):

```typescript
// Import the new hook
import { useInstagramPosts } from "@/hooks/useInstagramPosts";

// Fetch Instagram posts
const { posts: instagramPosts, fetchPosts: fetchInstagramPosts } = useInstagramPosts();

// Convert to Memory format
const instagramAsMemories = useMemo((): Memory[] => {
  return instagramPosts.map(post => ({
    id: `instagram-local-${post.instagram_post_id}`,
    content: formatInstagramMemory(post),
    tag: 'INSTAGRAM',
    createdAt: post.posted_at,
    imageDataBase64: null,
    // Store media_url for display
  }));
}, [instagramPosts]);

// Merge with existing memories
const allMemories = useMemo((): Memory[] => {
  const combined = [...memories, ...twitterAsMemories, ...instagramAsMemories];
  // Deduplicate and sort...
}, [memories, twitterAsMemories, instagramAsMemories]);
```

### 6. Update `force-reset-sync` Action

Ensure the reset action also clears the new content table:

```typescript
case 'force-reset-sync': {
  // Clear content table
  await supabase
    .from('instagram_synced_post_content')
    .delete()
    .eq('user_id', userId);
    
  // Clear deduplication table (existing)
  await supabase
    .from('instagram_synced_posts')
    .delete()
    .eq('user_id', userId);
    
  // Reset config (existing)
  // ...
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | New `instagram_synced_post_content` table |
| `supabase/functions/instagram-sync/index.ts` | Modify | Store posts locally + add `list-synced-posts` action |
| `src/types/instagramSync.ts` | Modify | Add `InstagramStoredPost` interface |
| `src/hooks/useInstagramPosts.ts` | Create | Hook to fetch stored Instagram posts |
| `src/pages/Memories.tsx` | Modify | Merge Instagram posts with LIAM memories |

---

## Migration for Existing Data

Since 11 posts are already synced but content wasn't stored locally:

1. Click **"Reset & Re-sync All Posts"** in the Instagram Dump flow
2. Next sync will store complete post data in `instagram_synced_post_content`
3. Each post will appear as its own memory entry in the Memories page

---

## Expected Outcome

After implementation:
- Every synced Instagram post is stored with full content locally
- Posts display individually with caption, media, and engagement metrics
- LIAM API continues to provide semantic search for Instagram content
- True 1:1 storage guarantees no content loss
- Consistent with the proven Twitter Alpha Tracker pattern
