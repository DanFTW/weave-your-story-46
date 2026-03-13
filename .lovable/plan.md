

## Analysis: Why the Workspace Picker Shows Stale Data

**Root Cause (Rubber Duck Analysis):**

The `slack-messages-sync` edge function uses a **single shared environment variable** `SLACK_USER_TOKEN` (line 114 of `index.ts`) for ALL Slack API calls, including `team.info` (workspace listing) and `conversations.list` (channel listing). This token is a Supabase secret that never changes when a user reconnects with a different Slack account.

The OAuth callback in `slack-oauth` **does** receive a fresh per-user access token (line 97: `tokenData.authed_user?.access_token`), but it **discards it** — it only saves profile metadata (name, email, avatar) to `user_integrations`. The token is never stored.

So the flow is:
1. User reconnects with a different Slack account → OAuth returns a new token for the new workspace
2. Token is thrown away; only profile info is saved
3. User opens Slack Message Monitor → `list-workspace` calls `team.info` using the old shared `SLACK_USER_TOKEN`
4. User sees the old workspace

**Fix: Store and use per-user tokens for workspace/channel discovery**

### Changes

**1. Database migration** — Add an `access_token` column to `user_integrations`:
```sql
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS access_token TEXT;
```
This column is protected by existing RLS policies (users can only access their own rows), and the edge function reads it via the service-role client.

**2. `supabase/functions/slack-oauth/index.ts`** — Store the user's access token during the OAuth callback. In the upsert (line 151-165), add `access_token: userToken` alongside the existing profile fields.

**3. `supabase/functions/slack-messages-sync/index.ts`** — For `list-workspace` and `list-channels` actions, fetch the user's per-user token from `user_integrations` (using admin/service-role client) and use it instead of the shared `SLACK_USER_TOKEN`. Fall back to the shared token if no per-user token exists.

For `poll`, `search`, `activate`, and `deactivate` actions, continue using the shared `SLACK_USER_TOKEN` as before (the shared token architecture for ongoing monitoring is unchanged).

```text
Before:
  All actions → SLACK_USER_TOKEN (shared env var)

After:
  list-workspace  → user's access_token from DB (fallback: shared)
  list-channels   → user's access_token from DB (fallback: shared)
  poll/search     → SLACK_USER_TOKEN (shared, unchanged)
```

No other flows or integrations are affected.

