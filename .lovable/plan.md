

## Fix: Add missing `team:read` scope to Slack OAuth

### Root Cause

The error "missing_scope" on `team.info` is because the OAuth scopes requested during Slack authorization (line 14 of `slack-oauth/index.ts`) do not include `team:read`:

```
Current:  channels:read,channels:history,search:read,users:read,users:read.email
```

The `list-workspace` action calls `team.info`, which requires `team:read`. The per-user token obtained via OAuth lacks this scope, so the API rejects the call.

### Fix (1 file)

**`supabase/functions/slack-oauth/index.ts`** line 14 — Add `team:read` to `SLACK_USER_SCOPES`:

```
"channels:read,channels:history,search:read,users:read,users:read.email,team:read"
```

### Post-fix note

After deploying, existing users who connected before this change will have tokens without `team:read`. They will need to disconnect and reconnect Slack to get a token with the updated scopes. New connections will work immediately.

