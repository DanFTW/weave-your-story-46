

## Fix: Coinbase profile data not populating on connected account card

### Root cause

The `composio-callback` edge function's Coinbase handler at line 3408 does `const accessToken = data.access_token`, but the Composio v3 API typically nests the OAuth access token under `connectionParams` within the response (e.g., `accountData.connectionParams.access_token` or `accountData.data.connectionParams.access_token`). Since `data` is set from `accountData.data || accountData.connection_params || {}` at line 2356, the `access_token` is likely nested one level deeper and not found, causing the entire Coinbase API call to be skipped silently. This leaves `account_name`, `account_email`, and `account_avatar_url` as null in the database.

### Fix (single file change)

**`supabase/functions/composio-callback/index.ts`** -- Update the Coinbase block (lines 3404-3446):

1. Expand access token resolution to check multiple nested locations, matching the pattern used by Canva (line 1843-1848):
   - `data.access_token`
   - `data.connectionParams?.access_token`
   - `accountData.connectionParams?.access_token`
   - `accountData.data?.connectionParams?.access_token`

2. If no token is found from the main `accountData`, make a dedicated fetch to the Composio connected account endpoint (`GET /api/v3/connected_accounts/{connectionId}`) to retrieve `connectionParams.access_token` -- the same approach used by Canva, Discord, and Mailchimp handlers.

3. Add logging for the resolved token source to aid future debugging.

4. Redeploy the `composio-callback` edge function.

### After deployment

The user will need to disconnect and reconnect Coinbase (or use the "Change" button) to trigger the callback again and populate the profile fields.

