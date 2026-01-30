

# Store Twitter Posts Locally for Reliable Display

## Root Cause Confirmed

After analyzing the edge function logs and LIAM API responses, the issue is now clear:

| Evidence | Finding |
|----------|---------|
| 97 tweets processed | All marked as processed in `twitter_alpha_processed_posts` |
| All API calls succeed | Every memory creation returns 200 OK with "Your memory has been recorded successfully" |
| Only 1 Twitter memory in LIAM | API response shows single entry: `"Twitter Post from @Shieldmetax on 20260129"` |
| Keys are correct | The `userkey` in API response matches the database exactly |

**The LIAM Memory API is a semantic search engine, not a document store.** It intentionally consolidates similar content into summarized "facts" for efficient retrieval. This is the expected behavior - all 97 tweets were merged into a single searchable fact.

Compare to Instagram which extracts multiple distinct facts per post (likes, hashtags, prices) because each post contains unique structured data that LIAM can tokenize separately.

## Solution: Hybrid Local Storage

Store tweets in a **local database table** while still sending to LIAM for semantic search capabilities.

### 1. Create New Table: `twitter_alpha_posts`

Stores the full content of each tracked tweet for reliable 1:1 retrieval:

```sql
CREATE TABLE twitter_alpha_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tweet_id TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  tweet_text TEXT NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tweet_id)
);

ALTER TABLE twitter_alpha_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own twitter posts" ON twitter_alpha_posts
  FOR SELECT USING (auth.uid() = user_id);
```

### 2. Update Edge Function to Store Locally

Modify `supabase/functions/twitter-alpha-tracker/index.ts` to:
- Insert tweets into `twitter_alpha_posts` with full content
- Continue sending to LIAM API for semantic search (fire-and-forget)
- Use the local table as the source of truth

### 3. Add `list-posts` Action

Add a new endpoint to retrieve stored tweets:

```typescript
case 'list-posts': {
  const { data: posts, error } = await supabase
    .from('twitter_alpha_posts')
    .select('*')
    .eq('user_id', userId)
    .order('tweet_created_at', { ascending: false })
    .limit(100);

  return new Response(JSON.stringify({ posts }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### 4. Create `useTwitterAlphaPosts` Hook

New frontend hook to fetch locally stored tweets:

```typescript
export function useTwitterAlphaPosts() {
  const [posts, setPosts] = useState<TwitterPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.functions.invoke('twitter-alpha-tracker', {
      body: { action: 'list-posts' },
    });
    if (data?.posts) setPosts(data.posts);
    setIsLoading(false);
  }, []);

  return { posts, isLoading, fetchPosts };
}
```

### 5. Merge Twitter Posts into Memories Page

Update `src/pages/Memories.tsx` to combine locally stored Twitter posts with LIAM memories:

```typescript
// Convert Twitter posts to Memory format
const twitterAsMemories: Memory[] = twitterPosts.map(post => ({
  id: `twitter-${post.tweet_id}`,
  content: `@${post.author_username}: ${post.tweet_text}`,
  tag: 'TWITTER',
  createdAt: post.tweet_created_at,
}));

// Merge with LIAM memories, deduplicate, and sort
const allMemories = [...memories, ...twitterAsMemories]
  .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Database migration | Create | New `twitter_alpha_posts` table |
| `supabase/functions/twitter-alpha-tracker/index.ts` | Modify | Store tweets locally + add `list-posts` action |
| `src/hooks/useTwitterAlphaPosts.ts` | Create | Hook to fetch stored Twitter posts |
| `src/pages/Memories.tsx` | Modify | Merge Twitter posts with LIAM memories |
| `src/types/twitterAlphaTracker.ts` | Modify | Add `TwitterPost` interface |

## Migration for Existing Data

Since 97 tweets are already processed but their content wasn't stored:

1. Reset sync history (using existing "Reset Sync History" button)
2. Next poll will re-fetch tweets from Twitter API
3. New tweets will be stored locally in `twitter_alpha_posts`
4. Each tweet appears as its own memory entry

## Expected Outcome

After implementation:
- Every tracked tweet is stored with full content in `twitter_alpha_posts`
- Tweets display individually in `/memories` page with author and content
- LIAM API continues to provide semantic search for tweets
- True 1:1 storage guarantees no content loss
- User's "wrong key" concern is addressed - keys are verified working, the issue was LIAM's consolidation behavior

