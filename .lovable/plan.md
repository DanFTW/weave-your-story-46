

## Root Cause Analysis: Slack OAuth Connection Failure

### Evidence Chain

1. **Edge function logs confirm**: `composio-connect` successfully calls Composio's `/link` endpoint and returns a `redirect_url` + `connected_account_id`. The auth config used is `ac_H9kYZsVaw_gS` (line 190 in `composio-connect/index.ts`).

2. **Composio's hosted link page fails**: When the user visits the redirect URL (`https://connect.composio.dev/link/lk_...`), the Composio-hosted page throws a ZodError with `invalid_union` failures. This is happening **on Composio's side**, not in our code — there are zero Zod imports or usages in our codebase.

3. **No callback ever fires**: `composio-callback` has zero logs for Slack, confirming the OAuth flow never completes. The user is stuck on Composio's broken link page.

4. **No database row exists**: `user_integrations` has no Slack row for this user. The polling in `useComposio` correctly finds nothing and the connection stays in "connecting" state until timeout.

5. **Wrong auth config ID**: The current `AUTH_CONFIGS.slack` is `ac_H9kYZsVaw_gS`. The user has confirmed the correct Composio auth config ID for Slack is `ac_1wq5vJ92z9wT`. The wrong config ID causes Composio's link page to fail with schema validation errors when trying to process the OAuth parameters.

### Root Cause

The Slack entry in the `AUTH_CONFIGS` map in `supabase/functions/composio-connect/index.ts` (line 190) uses the wrong Composio auth config ID (`ac_H9kYZsVaw_gS`). This causes Composio's hosted OAuth page to fail with a ZodError before the user can authorize, preventing the entire flow from completing.

### Fix

Single change in `supabase/functions/composio-connect/index.ts`:

| Line | Current | Fixed |
|------|---------|-------|
| 190 | `slack: "ac_H9kYZsVaw_gS"` | `slack: "ac_1wq5vJ92z9wT"` |

Then redeploy the edge function. No other files, pages, or integrations need changes.

