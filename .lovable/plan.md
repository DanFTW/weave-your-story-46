

## Investigation Results

The edge function logs confirm the issue clearly:

```
Connection ca_128a9PQLg_HC: auth_config=ac_P0DYB0XdGLn3, status=ACTIVE
Raw Gmail response: {"data":{"messages":[],...},"successful":true,"error":null}
Fetched 0 candidate emails
```

**The Gmail connection is valid, ACTIVE, and the API call succeeds.** The problem is the search query returns zero results.

### Root Cause

The `fetchReceiptEmails` function (line 317) uses this Gmail query:

```
subject:(receipt OR order confirmation OR purchase OR invoice OR payment) newer_than:7d
```

Two issues:
1. **Overly narrow query** — it only searches the `subject:` field. A Lovable purchase confirmation email may have a subject like "Your Lovable Pro plan is active" or "Subscription confirmed" which matches none of the keywords.
2. **Missing common keywords** — "subscription", "billing", "charge", "confirmation", "thank you for your order" are not included.

Additionally, the function uses the **Gmail** connection (`integration_id: "gmail"`) for `GMAIL_FETCH_EMAILS`, which is correct. But there's no logging of which connection ID or query was actually used, making it hard to debug without code changes.

### Plan

**File: `supabase/functions/email-receipt-sheet/index.ts`** — changes to `fetchReceiptEmails` only:

1. **Broaden the search query** — remove the `subject:` restriction so Gmail searches the full email body/headers, and add missing keywords:
   ```
   (receipt OR order OR purchase OR invoice OR payment OR subscription OR billing OR charge OR confirmation) newer_than:7d
   ```

2. **Add diagnostic logging** — log the Gmail connection ID, the exact query sent, and the full raw response (first 2000 chars) so future debugging doesn't require code changes:
   ```
   [ReceiptSheet] Gmail connection: ca_xxx
   [ReceiptSheet] Gmail query: ...
   [ReceiptSheet] Raw response (2000 chars): ...
   [ReceiptSheet] Messages found: N
   [ReceiptSheet] First message sample: { id, subject, snippet... }
   ```

3. **Increase `max_results`** from 20 to 50 to catch more candidates within the 7-day window.

No other files or features are changed.

