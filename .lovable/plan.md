

## Plan: Rebuild Slack OAuth with Native Slack OAuth 2.0

### Problem
Slack connection uses Composio as an intermediary, which is failing. The user wants native Slack OAuth using their own "Weave Fabric" Slack app.

### Approach
Create a new edge function `slack-oauth` that handles both initiation and callback. Modify `useComposio` and `OAuthComplete` to route Slack through this native flow instead of Composio. The `composio-disconnect` already has a DB-only fallback, so disconnect will still work.

### Changes

**1. New edge function: `supabase/functions/slack-oauth/index.ts`**

Handles two actions:
- `initiate`: Builds Slack OAuth URL (`https://slack.com/oauth/v2/authorize`) with user_scope params (`channels:read,channels:history,search:read,users:read`), client_id, and redirect_uri. Returns the URL.
- `callback`: Receives `code` from the OAuth redirect, exchanges it at `https://slack.com/api/oauth.v2.access` using SLACK_CLIENT_ID + SLACK_CLIENT_SECRET, fetches user identity via `https://slack.com/api/users.identity` or parses the token response, then upserts into `user_integrations` with status=connected.

Uses existing secrets: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.

**2. Add to `supabase/config.toml`**
```toml
[functions.slack-oauth]
verify_jwt = false
```

**3. Modify `src/hooks/useComposio.ts`**

In the `connect` function, add a Slack-specific branch before the Composio flow:
- If `toolkit === "slack"`, call `slack-oauth` with `action: "initiate"` instead of `composio-connect`.
- The rest (redirect handling, polling) stays the same since it polls `user_integrations`.

In the `disconnect` function, add a Slack-specific branch:
- Skip the Composio revoke call; just delete the `user_integrations` row directly.

**4. Modify `src/pages/OAuthComplete.tsx`**

Add Slack-specific handling: when `toolkit=slack` and a `code` param is present (Slack OAuth callback), call `slack-oauth` with `action: "callback"` instead of `composio-callback`. The success/error/redirect logic remains the same.

### What stays unchanged
- All other integrations continue using Composio
- `IntegrationDetail.tsx` — no changes needed (it already delegates to `useComposio`)
- Database schema — `user_integrations` table already has all needed columns
- UI components — no visual changes

### Flow summary
```text
User clicks Connect
  → useComposio.connect() detects toolkit=slack
  → calls slack-oauth {action: "initiate"}
  → returns redirectUrl to https://slack.com/oauth/v2/authorize?...
  → user authorizes on Slack
  → Slack redirects to /oauth-complete?code=XXX&state=slack
  → OAuthComplete detects toolkit from state param
  → calls slack-oauth {action: "callback", code: XXX}
  → edge fn exchanges code for token, fetches user info
  → upserts user_integrations row
  → OAuthComplete shows success, redirects back
  → useComposio polling detects connected row
```

