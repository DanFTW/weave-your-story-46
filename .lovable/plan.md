

## Fix Gmail send field name

The Composio `GMAIL_SEND_EMAIL` tool expects `body` in its arguments, but the `sendEmail` function on line 298 passes `message_body`. This causes the error: `"Following fields are missing: {'body'}"`.

### Change

**File:** `supabase/functions/weekly-event-finder/index.ts`, line 298

Change:
```typescript
message_body: bodyText,
```
To:
```typescript
body: bodyText,
```

### Post-change
Redeploy the `weekly-event-finder` edge function.

