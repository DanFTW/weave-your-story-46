
# Fix Twitter Alpha Tracker: Convert `expansions` Parameter to Array

## Root Cause Analysis

The debug logging revealed the exact error from the Twitter/Composio API:

```json
{
  "error": "Invalid request data provided\n- Input should be a valid list on parameter `expansions`",
  "successful": false
}
```

### The Bug

In `supabase/functions/twitter-alpha-tracker/index.ts`, line 195:

```typescript
arguments: {
  query,
  max_results: 100,
  'tweet.fields': 'created_at,public_metrics,author_id',
  expansions: 'author_id',  // ❌ STRING - API requires ARRAY
},
```

The Twitter API v2 (via Composio) requires `expansions` to be an **array of strings**, not a single string. The working `twitter-sync` function doesn't use expansions at all, which is why it works.

---

## Solution

Change `expansions` from a string to an array:

```typescript
arguments: {
  query,
  max_results: 100,
  'tweet.fields': 'created_at,public_metrics,author_id',
  expansions: ['author_id'],  // ✅ ARRAY - Correct format
},
```

---

## Technical Details

### File to Modify

`supabase/functions/twitter-alpha-tracker/index.ts`

### Specific Change (Line 195)

| Before | After |
|--------|-------|
| `expansions: 'author_id',` | `expansions: ['author_id'],` |

### Why This Works

The Twitter API v2 specification requires:
- `tweet.fields` - comma-separated string (current format is correct)
- `expansions` - array of strings (current format is wrong)

This is confirmed by the official Twitter API documentation and the Composio error message.

---

## Expected Outcome

After this one-line fix:

1. API requests will succeed (HTTP 200 with actual data)
2. Tweets from tracked accounts will be returned
3. New posts from @cafecitodao, @Shieldmetax, @LoverPlaid will be detected
4. Memories will be created automatically

---

## Verification Steps

After deployment:
1. Click "Sync Now" on the Twitter Alpha Tracker page
2. Edge function logs should show actual tweet data instead of the validation error
3. New posts from tracked accounts should appear as memories
