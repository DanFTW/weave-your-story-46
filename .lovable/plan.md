# Fix Facebook Sync: Direct Graph API + forwardRef warnings

## Problem 1: Zero posts imported

The edge function uses `FACEBOOK_GET_PAGE_POSTS` (a Composio tool for Facebook Pages), but the connected account is a personal Facebook account. This returns empty results. Need to bypass Composio's tool and call the Facebook Graph API directly using the access token from the Composio connection.

## Problem 2: forwardRef warnings

## React warns about refs on `FacebookSyncFlow` and `FacebookSyncActive` function components. Wrap both with `React.forwardRef`.

## Changes

### 1. `supabase/functions/facebook-sync/index.ts` — rewrite `fetchFacebookPosts`

Replace the Composio `FACEBOOK_GET_PAGE_POSTS` call with:

1. **Get access token**: Follow the exact same access token retrieval pattern used in the existing `birthday-reminder` or `calendar-event-sync` edge functions.
2. **Call Graph API directly**: `GET https://graph.facebook.com/v19.0/me/posts?fields=id,message,created_time,permalink_url&limit=100&access_token={token}`
3. **Paginate**: Follow `paging.next` URLs until no more pages, collecting all posts.
4. Keep the same `FacebookPost` interface and return type.
5. Add logging for token retrieval, Graph API responses, and pagination.

### 2. `src/components/flows/facebook-sync/FacebookSyncFlow.tsx` — wrap with forwardRef

Wrap the `FacebookSyncFlow` export with `React.forwardRef` so it can accept a ref without warning.

### 3. `src/components/flows/facebook-sync/FacebookSyncActive.tsx` — wrap with forwardRef

Wrap the `FacebookSyncActive` export with `React.forwardRef`.

### Files changed

- `supabase/functions/facebook-sync/index.ts`
- `src/components/flows/facebook-sync/FacebookSyncFlow.tsx`
- `src/components/flows/facebook-sync/FacebookSyncActive.tsx` No other files touched.