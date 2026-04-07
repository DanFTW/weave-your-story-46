

## Fix: SMS alerts failing with 502 but alert count still incrementing

### Problem

Two issues confirmed from the edge function logs:

1. **SMS gateway returning 502**: The log shows `[TextAlert] SMS send failed 502: {"error":"Failed to send SMS"}`. The Render-hosted SMS gateway at `https://weave-fabric-sms.onrender.com/send` is returning a 502 (Bad Gateway), likely because the free-tier Render service spins down after inactivity and the first request hits a cold start timeout.

2. **Alert count increments regardless of SMS delivery**: In the manual-sync handler (line 310-311), `sendSms` is fire-and-forget — its return value is ignored, and `alertCount++` runs unconditionally. The counter reflects "emails processed" rather than "alerts actually delivered."

### Solution — single file: `supabase/functions/email-text-alert/index.ts`

**1. Make `sendSms` return a boolean (like the weekly-event-finder version)**

Change the return type from `void` to `boolean` so callers can check delivery status:
```typescript
async function sendSms(to: string, body: string): Promise<boolean> {
  // ... existing fetch logic ...
  if (!res.ok) { /* log error */ return false; }
  return true;
  // catch: return false;
}
```

**2. Add retry logic for cold-start 502s**

Render free-tier services sleep after 15 minutes of inactivity. The first request often gets a 502 or timeout. Add a single retry with a short delay to handle this:
```typescript
// Inside sendSms, after a 502 response:
if (res.status === 502) {
  console.log("[TextAlert] SMS gateway cold start, retrying in 3s...");
  await new Promise(r => setTimeout(r, 3000));
  // retry the fetch once
}
```

**3. Only increment alertCount when SMS actually succeeds**

Update the manual-sync loop (line 310-311) to check the return value:
```typescript
const sent = await sendSms(configData.phone_number, summary);
if (sent) alertCount++;
```

This ensures the UI counter ("X alerts sent") reflects actual deliveries, not just processed emails.

**4. Redeploy the edge function.**

### Why this works

- The retry handles Render's cold-start behavior, which is the most likely cause of the 502.
- The boolean return aligns with the pattern already used in `weekly-event-finder`.
- Conditional counting ensures the alert count is accurate.
- No other files or logic are changed.

