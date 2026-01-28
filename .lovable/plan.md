

# Update Cron Job Frequency to Every Minute

## Problem

The user wants the Twitter Alpha Tracker to check for new tweets/posts every **1 minute** instead of every 5 minutes for more real-time tracking.

## Changes Required

### 1. Update UI Messaging

**File:** `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx`

Change line 76 from:
```
Background sync every 5 minutes
```
to:
```
Background sync every minute
```

### 2. Update pg_cron Job (Manual Step)

The user must update the cron schedule in the Supabase SQL Editor.

**If cron job already exists**, first unschedule it:
```sql
SELECT cron.unschedule('twitter-alpha-tracker-poll');
```

**Then create the new schedule (every minute):**
```sql
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

**Cron expression change:**
- Before: `*/5 * * * *` (every 5 minutes)
- After: `* * * * *` (every minute)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx` | Update text from "5 minutes" to "every minute" |

## Manual SQL Required

Replace `YOUR_CRON_SECRET_VALUE` with the actual secret from Edge Function settings. The cron expression `* * * * *` runs every minute.

---

## Rate Limit Consideration

Running every minute is 12x more frequent than every 5 minutes. Ensure the Twitter API rate limits can handle this volume, especially if multiple users have active tracking. The current batching strategy (`from:user1 OR from:user2`) helps minimize API calls per poll.

