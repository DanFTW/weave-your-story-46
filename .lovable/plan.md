

## Investigation Results

The edge function logs show exactly what's happening. Two bugs are causing zero posted rows:

### Bug 1: `.onConflict()` crashes every email (PRIMARY CAUSE)

Every single email processing throws the same error:
```
TypeError: sb.from(...).insert(...).onConflict is not a function
```

The Supabase JS v2 client does not have an `.onConflict()` method on `.insert()`. The correct method is `.upsert()` with `onConflict` as an option. This crash happens at line 635 — after the LLM call returns but before the result can be acted upon. Every email hits the `catch` block, so `totalPosted` stays at 0.

### Bug 2: Email body field name mismatch

The log shows the Gmail response uses `messageText` as the body field:
```
"messageText":"Lovable Labs Incorporated ... Receipt #2148-7756 ..."
```

But line 605 tries: `e.body ?? e.snippet ?? e.text ?? e.content ?? e.data ?? ""`

None of these match `messageText`, so the LLM receives an empty string for every email. Even if Bug 1 were fixed, the LLM would see no content and return `isReceipt: false`.

### Plan — single file change: `supabase/functions/email-receipt-sheet/index.ts`

1. **Fix body extraction** (line 605): Add `e.messageText` to the fallback chain, placing it first since that's the field Composio actually returns.

2. **Fix `.onConflict()` crash** (lines 629-635): Replace `.insert({...}).onConflict("user_id,email_message_id")` with `.upsert({...}, { onConflict: "user_id,email_message_id" })`.

3. **Add diagnostic logging** in the processing loop:
   - Log the email body length and first 200 chars being sent to the LLM
   - Log the LLM's parsed result (`isReceipt`, `vendor`, `amount`)
   - This surfaces what the LLM receives and returns without needing code changes next time

No other files or features changed. Redeploy after edit.

