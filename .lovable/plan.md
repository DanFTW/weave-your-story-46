
# Fix Twitter Alpha Tracker: Add Debug Logging and Improve API Handling

## Problem Analysis

The background polling is now authenticated and running every minute, but **0 tweets are being returned** every time. The system is silently failing because there's no logging of the raw Twitter API response.

### Current Behavior

```
Fetching tweets with query: from:cafecitodao OR from:Shieldmetax OR from:LoverPlaid
Fetched 0 tweets from 3 accounts
```

### Missing Information

We cannot diagnose whether:
- The Twitter API is returning an error
- Rate limits are being hit
- The accounts genuinely have no new posts in the 7-day window
- The response structure has changed

## Solution: Add Comprehensive Debug Logging

Modify the `fetchMultipleUsersTweets` function to log the raw API response, similar to how `twitter-sync` handles it. This will expose exactly what the Composio/Twitter API is returning.

---

## Technical Changes

### File: `supabase/functions/twitter-alpha-tracker/index.ts`

#### Update `fetchMultipleUsersTweets` function (lines 174-243)

**Current code (silent failure):**
```typescript
const response = await fetch('...TWITTER_RECENT_SEARCH', {...});
if (!response.ok) {
  console.error('Failed to fetch tweets:', await response.text());
  return [];
}
const data = await response.json();
```

**Updated code (with debug logging):**
```typescript
const response = await fetch('...TWITTER_RECENT_SEARCH', {...});

// Log raw response for debugging
const responseText = await response.text();
console.log('Twitter API response status:', response.status);
console.log('Twitter API response (first 2000 chars):', responseText.slice(0, 2000));

if (!response.ok) {
  console.error('Failed to fetch tweets:', responseText);
  return [];
}

const data = JSON.parse(responseText);
const responseData = data?.data || data;

// Log response structure
console.log('Response structure keys:', Object.keys(responseData || {}));
if (responseData?.response_data) {
  console.log('response_data keys:', Object.keys(responseData.response_data || {}));
  console.log('result_count:', responseData.response_data?.meta?.result_count);
}
```

This will reveal:
1. HTTP status code from Twitter API
2. Raw response body (errors, rate limits, or empty results)
3. Response structure for debugging parsing issues
4. Tweet count metadata from the API

---

## Additional Improvements

### 1. Handle API rate limit responses

```typescript
// Check for rate limit or other API issues
if (response.status === 429) {
  console.log('Twitter API rate limit hit - will retry on next poll');
  return [];
}

if (response.status >= 400) {
  console.error(`Twitter API error ${response.status}:`, responseText);
  return [];
}
```

### 2. Add `result_count` logging

Twitter API v2 returns `meta.result_count` which tells us how many tweets matched without parsing:

```typescript
const resultCount = responseData?.response_data?.meta?.result_count || 
                    responseData?.meta?.result_count || 0;
console.log(`Twitter API returned ${resultCount} results for query`);
```

### 3. Log when accounts have no recent activity

```typescript
if (tweets.length === 0) {
  console.log(`No tweets found in last 7 days for accounts: ${usernames.join(', ')}`);
  console.log('This is expected if tracked accounts have not posted recently');
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/twitter-alpha-tracker/index.ts` | Add comprehensive logging to `fetchMultipleUsersTweets` function |

---

## Expected Outcome

After deployment, edge function logs will show exactly what the Twitter API returns:

**If API returns empty results:**
```
Twitter API response status: 200
Twitter API response: {"data":{"response_data":{"meta":{"result_count":0}}}}
Twitter API returned 0 results for query
No tweets found in last 7 days for accounts: cafecitodao, Shieldmetax, LoverPlaid
This is expected if tracked accounts have not posted recently
```

**If API has an error:**
```
Twitter API response status: 401
Twitter API response: {"error":"unauthorized"...}
```

**If rate limited:**
```
Twitter API response status: 429
Twitter API rate limit hit - will retry on next poll
```

---

## Why This Matters

Currently the system is a "black box" - we can't see what's happening inside. Adding logging will:

1. **Diagnose the actual issue** - Is it empty results, API errors, or parsing bugs?
2. **Enable faster debugging** - Future issues will be immediately visible in logs
3. **Build confidence** - Users can see the system is working even when there are no new tweets

## Summary

| What | Action |
|------|--------|
| Root cause | Unknown - need debug logging to diagnose |
| Change | Add comprehensive Twitter API response logging |
| Files | 1 edge function file |
| Risk | None - only adds logging, doesn't change behavior |
