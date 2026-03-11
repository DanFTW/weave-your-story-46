

# Fix Memory Content for Facebook Page Posts

## Problem
The `formatPostAsMemory` function includes URL, post ID, and metadata in the memory content. Posts without a message are saved with "[No text content]" instead of being skipped.

## Changes — `supabase/functions/facebook-sync/index.ts`

### 1. Update `formatPostAsMemory` (lines 334-356)
- Make the post's `message` field the primary content of the memory
- Move URL and post ID to a small metadata footer only
- Remove the "[No text content]" fallback — posts without messages will be skipped before this function is called

New format:
```
{post.message}

---
Source: Facebook Page | Post ID: {id} | URL: {permalink_url}
```

### 2. Skip posts with no message (line 284, in the sync loop)
Add a check before calling `formatPostAsMemory`: if `!post.message`, skip the post (continue the loop). This ensures empty posts never create memories.

### No other changes
- Edge function structure, Graph API calls, dedup logic, crypto signing — all untouched.
- Redeploy after edit.

