

# Switch Facebook Sync from Personal Timeline to Page Posts

## Changes to `supabase/functions/facebook-sync/index.ts`

### 1. Remove `validateFacebookToken` function (lines 143-165)
Delete the entire function — `user_posts` permission check no longer applies.

### 2. Rewrite `fetchFacebookPosts` (lines 167-221)
Replace the validation call and `/me/posts` logic with:

1. **Get page token**: Call `GET /v19.0/me/accounts?fields=id,name,access_token&access_token={userToken}`
   - If no pages returned, return `{ posts: [], error: "No Facebook Pages found. Please make sure you have a Facebook Page connected." }`
   - Take the first page's `id` and `access_token`
   - Log the page name/id for debugging

2. **Fetch page posts**: Use `GET /v19.0/{pageId}/posts?fields=id,message,created_time,permalink_url&limit=100&access_token={pageToken}`
   - Keep existing pagination loop (`paging.next`) and post mapping logic unchanged

### No other changes
- `getAccessToken`, `syncFacebookContent`, `formatPostAsMemory`, `createMemory`, crypto utilities — all untouched.
- Redeploy after edit.

