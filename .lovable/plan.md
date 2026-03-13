

## Plan: Use SLACK_USER_TOKEN secret for Slack API calls

The `SLACK_USER_TOKEN` secret already exists in Supabase. Both edge functions currently look up the token from `user_integrations.composio_connection_id` per-user. Instead, they should read `Deno.env.get("SLACK_USER_TOKEN")` directly.

### Changes to `supabase/functions/slack-messages-sync/index.ts`

- **Remove** the DB query for `composio_connection_id` (lines 42-70) — replace with reading `SLACK_USER_TOKEN` from env
- If the env var is missing, return the existing `needsReconnect` payload
- Update `slackApi` to use the env-sourced token instead of `integration.composio_connection_id`

### Changes to `supabase/functions/slack-oauth/index.ts`

- **Callback action**: Keep the OAuth exchange and user profile fetch logic, but stop writing `composio_connection_id: userToken` in the upsert. The upsert still marks `status: "connected"` with account info for UI purposes.
- Remove the `composio_connection_id` field from the upsert object (line 161)

### No other files touched

The frontend already checks `status === "connected"` which will continue to work. The token for API calls now comes from the shared secret.

