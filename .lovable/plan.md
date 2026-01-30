

# Fix Twitter Alpha Tracker Memory Creation & Display

## Problem Summary

The Twitter Alpha Tracker successfully tracks posts (167 in the database) but memories are not displaying correctly in the `/memories` page. The root cause is multi-faceted:

| Issue | Location | Impact |
|-------|----------|--------|
| Content format too plain | `formatTweetAsMemory()` in edge function | LIAM API tokenizes content, losing tweet text |
| Only 1 Twitter memory visible | LIAM API response | 167 posts processed but only 1 memory returned |
| Truncated content display | Memory content field | Shows `"Twitter Post from @Shieldmetax on 20260129"` instead of full tweet |

## Root Cause Analysis

The LIAM Memory API is designed for **semantic search**, not full-text storage. It tokenizes content into searchable facts:

```text
Input:  "Twitter Post from @Shieldmetax\nJanuary 29, 2026\n\n🚨 MARKET MANIPULATION 🚨..."
Output: "Twitter Post from @Shieldmetax on 20260129" (summarized)
Tokens: ["Twitter Post", "@Shieldmetax", "20260129"]
```

Compare this to how Instagram memories work (successfully):
```text
Input:  "Instagram Post by @user\nPosted on January 17, 2026\n\n"terminal galaxy rainbow"\n\nThis post received 26 likes and 4 comments."
Output: "Instagram post has a image and a link" (one of several extracted facts)
Tokens: ["Instagram post", "January 17, 2026", "terminal", "galaxy", "rainbow", "26 likes", "4 comments", ...]
```

The key insight: **Instagram content is formatted with discrete facts** that the LIAM tokenizer can extract as separate memories. Twitter content is formatted as prose, which gets summarized into a single memory.

## Solution

Reformat `formatTweetAsMemory()` to structure tweet data as **extractable facts** that the LIAM API can tokenize effectively. This follows the same pattern used successfully by Instagram sync.

## Technical Changes

### 1. Update `formatTweetAsMemory()` in Edge Function

**File:** `supabase/functions/twitter-alpha-tracker/index.ts` (lines 312-321)

**Current Implementation:**
```typescript
function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Twitter Post from @${tweet.authorUsername}\n${date}\n\n${tweet.text}\n\nA post from an account you're tracking.`;
}
```

**New Implementation:**
```typescript
function formatTweetAsMemory(tweet: Tweet): string {
  const date = new Date(tweet.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let memory = `Twitter/X Post from @${tweet.authorUsername}`;
  memory += `\nPosted on ${date}\n\n`;
  
  // Quote the tweet text for clear extraction
  if (tweet.text) {
    memory += `"${tweet.text}"\n\n`;
  }
  
  // Add explicit metadata for LIAM tokenization
  memory += `This is a tracked post from @${tweet.authorUsername} on Twitter/X.`;
  
  // Include post ID for reference
  memory += `\n\n[tweet_id:${tweet.id}]`;

  return memory;
}
```

### 2. Add Tweet Metrics to Memory Content (Enhanced)

To improve tokenization, include engagement metrics if available from the Twitter API:

```typescript
interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  authorUsername: string;
  metrics?: {
    likeCount?: number;
    retweetCount?: number;
    replyCount?: number;
  };
}
```

### 3. Clear Processed Posts to Allow Re-sync

Since 167 posts have already been marked as processed with the old format, the user needs a way to re-sync:

**Add a `reset-sync` action** to the edge function:
```typescript
case "reset-sync": {
  // Clear all processed posts for this user
  await supabase
    .from('twitter_alpha_processed_posts')
    .delete()
    .eq('user_id', userId);
    
  // Reset stats
  await supabase
    .from('twitter_alpha_tracker_config')
    .update({ posts_tracked: 0, last_polled_at: null })
    .eq('user_id', userId);
    
  await supabase
    .from('twitter_alpha_tracked_accounts')
    .update({ posts_tracked: 0 })
    .eq('user_id', userId);

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Sync history cleared. Next poll will re-process all tweets.' 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

### 4. Add Memory Creation Logging

Ensure memory creation is logged for debugging:

```typescript
async function createMemory(apiKeys: {...}, content: string): Promise<boolean> {
  try {
    console.log('Creating memory with content length:', content.length);
    console.log('Memory content preview:', content.slice(0, 200));
    // ... rest of function
  }
}
```

### 5. Enhance Twitter Memory Display in MemoryCard

**File:** `src/components/memories/MemoryCard.tsx`

Add Twitter-specific content parsing similar to Instagram:

```typescript
// Check if this is a Twitter memory
const isTwitterMemory = 
  memory.tag?.toLowerCase() === 'twitter' || 
  memory.content.toLowerCase().startsWith('twitter') ||
  memory.content.toLowerCase().includes('twitter/x post');

// Clean content for display
const displayContent = isTwitterMemory 
  ? cleanTwitterContentForDisplay(memory.content) 
  : memory.content;

function cleanTwitterContentForDisplay(content: string): string {
  return content
    .replace(/\[tweet_id:[^\]]+\]/g, '')  // Remove tweet ID tag
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/twitter-alpha-tracker/index.ts` | Update `formatTweetAsMemory()`, add `reset-sync` action, add logging |
| `src/components/memories/MemoryCard.tsx` | Add Twitter content display handling |
| `src/hooks/useTwitterAlphaTracker.ts` | Add `resetSync()` function for UI access |
| `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx` | Add "Reset Sync" button in danger zone |

## Data Migration

After deploying the fix, users should:
1. Use the "Reset Sync" feature to clear processed posts
2. Trigger a manual poll to re-process all recent tweets with the new format
3. Verify memories appear correctly in `/memories`

## Expected Outcome

After implementation:

1. **Twitter posts create rich memories** with quoted tweet text and metadata
2. **LIAM API extracts meaningful tokens** from structured content
3. **Memories display the full tweet content** in the `/memories` page
4. **Users can reset sync** to re-process tweets with the new format

## Example Memory Output

Before (current):
```
Twitter Post from @Shieldmetax on 20260129
```

After (fixed):
```
Twitter/X Post from @Shieldmetax
Posted on January 29, 2026

"🚨 MARKET MANIPULATION 🚨
Spot gold officially breaks below $5,000/oz, down -11% in a single day..."

This is a tracked post from @Shieldmetax on Twitter/X.
```

