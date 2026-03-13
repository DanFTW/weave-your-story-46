

## Root Cause

The edge function logs show the exact error:

```
"needed":"groups:read","provided":"identify,channels:history,channels:read,search:read,team:read,users:read,users:read.email"
```

The `conversations.list` call in `slack-messages-sync` requests `types: "public_channel,private_channel"`. Listing **private channels** requires the `groups:read` scope, which is not in the OAuth scopes requested on line 14 of `slack-oauth/index.ts`.

Same pattern as the previous `team:read` fix — the scope just needs to be added.

## Fix (1 file)

**`supabase/functions/slack-oauth/index.ts`** line 14 — add `groups:read`:

```typescript
const SLACK_USER_SCOPES = "channels:read,channels:history,groups:read,search:read,users:read,users:read.email,team:read";
```

After deploying, existing users must disconnect and reconnect Slack to get a token with the new scope.

