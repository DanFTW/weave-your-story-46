

# Add Preflight Permission Check to facebook-sync Edge Function

## What & Why

Logs confirm the token is retrieved (`Access token retrieved: yes`) and the Graph API returns HTTP 200 — but with an empty `data` array (response length: 11 bytes = `{"data":[]}`). This means the token lacks `user_posts` permission or is page-context. Adding a preflight check will surface a clear, actionable error instead of silently reporting 0 posts.

## Changes

**File: `supabase/functions/facebook-sync/index.ts`**

Insert a preflight validation function and call it at the top of `fetchFacebookPosts`, before the pagination loop (after line 149, before line 151):

1. **New function `validateFacebookToken(accessToken: string)`** that:
   - Calls `GET https://graph.facebook.com/v19.0/me?fields=id,name&access_token={token}`
   - If it fails or returns no `id`, throws: token is not user-context
   - Calls `GET https://graph.facebook.com/v19.0/me/permissions?access_token={token}`
   - Parses response, checks if `user_posts` appears with `status: "granted"`
   - If missing, throws with the required error message
   - Logs the user identity and granted permissions for debugging

2. **In `fetchFacebookPosts`**, after getting the access token (line 145-148), call `validateFacebookToken(accessToken)`. If it throws, log the error, and return the error message up the chain.

3. **Change `fetchFacebookPosts` return type** to `Promise<{ posts: FacebookPost[]; error?: string }>` so the error message can propagate to the sync response with `success: false`.

4. **In `syncFacebookContent`**, update the call site (line 207) to destructure `{ posts, error }` and return `{ success: false, postsSynced: 0, memoriesCreated: 0, error }` if an error is present.

### Error message when validation fails
`"Facebook permission user_posts missing or token is not user-context. Reconnect Facebook and approve timeline access."`

### No other changes
- Existing `/me/posts` pagination logic untouched
- No other files modified
- Redeploy after edit

