

# Fix Twitter Alpha Tracker - Ensure Every Post Creates a Memory

## Problem Summary

The Twitter Alpha Tracker tracks posts (168 in database) but memories don't appear consistently. Analysis reveals:

| Finding | Evidence | Impact |
|---------|----------|--------|
| Memory creation works | Logs show "Memory created successfully" for new tweets | Core functionality is OK |
| 168 tweets already processed | Database query shows posts from Jan 28-30 | Old tweets can't be re-synced automatically |
| Reset sync not triggered | No logs for "Reset sync requested" | User needs to click the reset button |
| No rate limiting | Rapid-fire memory creation for 97+ tweets | LIAM API may silently drop requests |

## Solution: Three-Part Fix

### Part 1: Add Delay Between Memory Creations

When processing many tweets, the LIAM API may throttle or drop requests. Add a delay between creations:

**File:** `supabase/functions/twitter-alpha-tracker/index.ts`

```typescript
// Add delay utility
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// In processTrackedUsers(), add delay between memory creations
for (const tweet of newTweets) {
  const memory = formatTweetAsMemory(tweet);
  const success = await createMemory(apiKeys, memory);

  if (success) {
    await supabase
      .from('twitter_alpha_processed_posts')
      .insert({ user_id: userId, tweet_id: tweet.id });
    
    newPosts++;
    postsByAuthor[tweet.authorUsername] = (postsByAuthor[tweet.authorUsername] || 0) + 1;
    
    // Wait 500ms between memory creations to avoid rate limiting
    if (newTweets.indexOf(tweet) < newTweets.length - 1) {
      await delay(500);
    }
  } else {
    // Log failure but don't mark as processed - will retry on next poll
    console.error(`Failed to create memory for tweet ${tweet.id}, will retry on next poll`);
  }
}
```

### Part 2: Enhanced Error Logging in createMemory()

Add detailed logging when LIAM API fails:

**File:** `supabase/functions/twitter-alpha-tracker/index.ts`

```typescript
async function createMemory(apiKeys: {...}, content: string): Promise<boolean> {
  try {
    console.log(`[Memory] Creating memory, content length: ${content.length}`);
    console.log(`[Memory] Preview: ${content.slice(0, 150)}...`);
    
    const requestBody = {
      content,
      userKey: apiKeys.user_key,
      tag: 'TWITTER',
    };
    
    const bodyString = JSON.stringify(requestBody);
    const signature = await signRequest(apiKeys.private_key, bodyString);

    const response = await fetch(LIAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': apiKeys.api_key,
        'signature': signature,
      },
      body: bodyString,
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`[Memory] SUCCESS - Response: ${responseText.slice(0, 200)}`);
      return true;
    } else {
      // Log full error details for debugging
      console.error(`[Memory] FAILED - Status: ${response.status}`);
      console.error(`[Memory] FAILED - Response: ${responseText}`);
      console.error(`[Memory] FAILED - Content was: ${content.slice(0, 300)}`);
      return false;
    }
  } catch (error) {
    console.error(`[Memory] EXCEPTION: ${error}`);
    return false;
  }
}
```

### Part 3: Auto-Trigger Reset on First Sync After Deploy

Since 168 tweets are stuck in "processed" state with old format, add logic to detect this condition and offer auto-reset:

**File:** `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx`

Add a warning banner when posts tracked >> visible memories:

```typescript
// At top of component, detect stale sync state
const hasStaleSync = stats.totalPostsTracked > 50 && stats.lastChecked;

// In JSX, add warning banner before status card
{hasStaleSync && (
  <div className="p-4 rounded-xl border border-amber-500/50 bg-amber-500/10">
    <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">
      <strong>Sync Update Available</strong>
    </p>
    <p className="text-xs text-muted-foreground mb-3">
      We've improved how Twitter posts are saved as memories. 
      Click below to re-sync your tracked posts with the new format.
    </p>
    <Button onClick={onResetSync} size="sm" variant="outline" className="w-full">
      <RotateCcw className="w-4 h-4 mr-2" />
      Reset & Re-sync All Posts
    </Button>
  </div>
)}
```

### Part 4: Process Tweets in Batches with Progress

Limit the number of tweets processed per poll to avoid timeouts and rate limits:

**File:** `supabase/functions/twitter-alpha-tracker/index.ts`

```typescript
// In processTrackedUsers(), batch processing
const BATCH_SIZE = 10; // Process max 10 tweets per poll
const tweetsToProcess = newTweets.slice(0, BATCH_SIZE);

console.log(`Processing ${tweetsToProcess.length} of ${newTweets.length} new tweets (batch limit: ${BATCH_SIZE})`);

for (const tweet of tweetsToProcess) {
  // ... existing processing logic with delay
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/twitter-alpha-tracker/index.ts` | Add delay between creations, batch processing, enhanced logging |
| `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx` | Add stale sync warning banner |

## Expected Outcome

After implementation:

1. **Rate limiting protection**: 500ms delay between memory creations prevents API throttling
2. **Batch processing**: Max 10 tweets per poll prevents timeouts, remaining tweets processed in subsequent polls
3. **Visible debugging**: Full error logging reveals any LIAM API issues
4. **User guidance**: Warning banner prompts user to reset sync after the fix
5. **Retry mechanism**: Failed tweets aren't marked as processed, so they retry on next poll

## Immediate User Action Required

After deploying these changes, the user should:
1. Click "Reset Sync History" on the active monitoring screen
2. Click "Sync Now" to trigger re-processing of all tweets
3. Wait for multiple poll cycles to complete (10 tweets per minute)
4. Check `/memories` page to see Twitter memories appearing

