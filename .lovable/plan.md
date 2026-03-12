

## Analysis

From the network requests, two different errors appear:
1. `{"error":"Slack not connected","code":"SLACK_TOKEN_MISSING","needsReconnect":true}` — token is null in DB
2. `{"error":"missing_scope"}` — token exists but Slack API rejects it for lacking `channels:read` scope

The second error is the current problem. The edge function correctly retrieves the token from `composio_connection_id` and passes it as `Bearer` to `conversations.list`. However, when Slack returns `missing_scope`, the function just passes the raw error string through (line 105) with status 200. The client does not recognize this as a reconnect scenario, so the user gets stuck.

The stored token likely predates the OAuth flow or was saved incorrectly (not a proper user token with the requested scopes).

## Plan — single file: `supabase/functions/slack-messages-sync/index.ts`

### 1. Add diagnostic logging after token retrieval
Log masked token (first 10 chars) so we can verify a real xoxp-* user token is stored vs garbage.

### 2. Treat Slack auth errors as reconnect-needed
After the `conversations.list` call, if `result.error` is one of `missing_scope`, `invalid_auth`, `token_revoked`, `not_authed`, or `account_inactive`, return the same `needsReconnect: true` payload instead of a bare error string. This lets the client show the reconnect UI.

### 3. Log the full Slack API error for all actions
Add `console.error` with the Slack API response when `!result.ok` for better debugging.

No other files will be changed. After redeployment, users with bad tokens will see the reconnect screen instead of a cryptic `missing_scope` error, and the logs will reveal what token is actually stored.

