
# Fix LinkedIn Live: Enable Automatic Connection Monitoring

## Root Cause Analysis

| Issue | Current State | Impact |
|-------|---------------|--------|
| No pg_cron job | ❌ Missing | Edge function never runs automatically |
| No `x-cron-trigger` fallback | ❌ Missing | Would fail even if cron existed (secret mismatch) |
| Missing CORS header | ❌ `x-cron-trigger` not in allowed list | Header would be blocked |

The database shows `is_active: true` for LinkedIn but without a cron job, the polling never happens.

---

## Solution: Three Changes

### Change 1: Update CORS Headers (Line 6)

Add `x-cron-trigger` to allowed headers:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-cron-trigger",
};
```

### Change 2: Add Fallback Authentication (Lines 497-505)

Update to accept `x-cron-trigger: supabase-internal` as fallback:

```typescript
// Handle cron-poll action (no user auth required, uses cron secret or internal trigger)
if (action === "cron-poll") {
  const cronSecret = req.headers.get("x-cron-secret");
  const cronTrigger = req.headers.get("x-cron-trigger");
  
  // Accept either: matching secret OR internal cron trigger header
  const validSecret = CRON_SECRET && cronSecret === CRON_SECRET;
  const validTrigger = cronTrigger === "supabase-internal";
  
  if (!validSecret && !validTrigger) {
    console.error("Cron poll: Invalid or missing authentication");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("Cron poll: Starting automatic LinkedIn check for all active users");
  // ... rest unchanged
}
```

### Change 3: Create pg_cron Job

Schedule the edge function to run every minute:

```sql
SELECT cron.schedule(
  'linkedin-automation-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/linkedin-automation-poll',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-trigger', 'supabase-internal',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
    ),
    body := jsonb_build_object('action', 'cron-poll')
  );
  $$
);
```

---

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/linkedin-automation-poll/index.ts` | 6 | Add `x-cron-trigger` to CORS |
| `supabase/functions/linkedin-automation-poll/index.ts` | 497-505 | Add fallback authentication |
| Database | N/A | Create `linkedin-automation-poll` cron job |

---

## How It Works

```text
┌─────────────────────┐
│     pg_cron         │
│  (every 1 minute)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│  linkedin-automation-poll Edge Function │
│  ─────────────────────────────────────  │
│  1. Validate x-cron-trigger header      │
│  2. Fetch all active LinkedIn configs   │
│  3. For each user:                      │
│     - Call LinkedIn Connections API     │
│     - Deduplicate via processed table   │
│     - Create memory for new connections │
│  4. Update stats in config table        │
└─────────────────────────────────────────┘
```

---

## Expected Outcome

Within 1-2 minutes after deployment:
- Edge function logs show: `"Cron poll: Starting automatic LinkedIn check for all active users"`
- New LinkedIn connections automatically create memories
- `/flow/linkedin-live` page shows updated connection count
