

## Fix: SMS 502 due to phone number format

### Root cause

The `sendSms` functions in both edge functions are identical — same URL, headers, body shape. The difference is the **phone number data stored in the database**:

- `email_text_alert_config`: `17863971484` (no `+` prefix)
- `weekly_event_finder_config`: `+13107023224` (has `+` prefix)

The SMS gateway's upstream provider (Twilio or similar) requires E.164 format, which mandates a `+` prefix. Without it, the upstream rejects the number, and the gateway returns `{"error":"Failed to send SMS"}` wrapped in a 502. The retry doesn't help because the number is still invalid on the second attempt.

The weekly-event-finder works only because the user happened to enter the `+` when configuring that flow.

### Solution — single file: `supabase/functions/email-text-alert/index.ts`

**Normalize the phone number to E.164 in `sendSms`** before making the request. Strip non-digit characters, then prepend `+` if missing. This matches the pattern that makes weekly-event-finder work, and is defensive against any user input format.

Add at the top of `sendSms` (line ~186):

```typescript
async function sendSms(to: string, body: string): Promise<boolean> {
  // Normalize to E.164: strip non-digits, ensure + prefix
  const digits = to.replace(/\D/g, "");
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;

  // ... rest of function uses `normalized` instead of `to`
}
```

Update the `JSON.stringify({ to, body })` to use `normalized`:
```typescript
const payload = JSON.stringify({ to: normalized, body });
```

And the success log:
```typescript
console.log(`[TextAlert] SMS sent to ${normalized}`);
```

**Redeploy the edge function.**

### Why this works

- E.164 format (`+17863971484`) is the universal standard for SMS APIs
- The weekly-event-finder succeeds because its stored number already has `+`
- Normalizing at the `sendSms` boundary is defensive — works regardless of how the user typed the number
- No other changes needed

