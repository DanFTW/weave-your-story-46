

## Problem

The Slack connected account card is missing the user's email and profile picture because:

1. **Email**: The Slack OAuth scopes don't include `users:read.email`. Without this scope, Slack's `users.info` API returns an empty `profile.email` field. The DB confirms `account_email` is empty.
2. **Profile picture**: The DB has a valid `account_avatar_url` from Slack CDN. It should render, but the user reports it's missing — possibly a stale/failed connection where avatar wasn't fetched, or the image fails to load.

## Plan

### 1. Add `users:read.email` scope to `slack-oauth` edge function

In `supabase/functions/slack-oauth/index.ts`, change line 14:
```
// Before
const SLACK_USER_SCOPES = "channels:read,channels:history,search:read,users:read";

// After  
const SLACK_USER_SCOPES = "channels:read,channels:history,search:read,users:read,users:read.email";
```

### 2. Store the Slack access token for future profile fetches

Add a `slack_access_token` column to `user_integrations` (or a separate secure table). Update the edge function callback to persist `userToken` alongside the profile data. This enables re-fetching profile data without requiring re-authorization.

**However** — storing OAuth tokens in a client-accessible table is a security concern. A better approach: store the token only in the edge function's upsert (add column), then create a small edge function or enhance `slack-oauth` with a `refresh-profile` action that re-fetches and updates the profile using the stored token.

### 3. Alternative simpler approach (recommended)

Since the real fix is adding the missing scope, and the avatar URL is already stored:

1. **Add `users:read.email` scope** to the edge function (line 14).
2. **Also request `image_192`** instead of `image_72` for a higher-res avatar.
3. **Require the user to reconnect Slack** (disconnect + connect) so the new scope takes effect and fresh profile data is fetched.

This avoids storing access tokens and keeps the architecture simple and consistent with how other integrations work (Composio fetches profile at connection time).

### 4. Deploy the edge function

The updated `slack-oauth` function will be auto-deployed.

### Files changed
- `supabase/functions/slack-oauth/index.ts` — add `users:read.email` scope, upgrade avatar to `image_192`

### User action required
After deployment, the user must **disconnect and reconnect** the Slack integration to authorize with the new scope. The email and higher-res avatar will then be fetched and stored.

