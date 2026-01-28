

# Enable Automatic Background Tracking for Twitter Alpha Tracker

## Problem

Users must manually click "Check Now" to fetch tweets from tracked accounts. Tracking should be automatic.

## Root Cause

The edge function already supports automated polling via a `cron-poll` action, but no Supabase `pg_cron` job has been configured to trigger it.

## Solution

Set up a background cron job to automatically poll every 5 minutes, matching the pattern used by other automation threads (Instagram Live, Twitter Live).

---

## Implementation Steps

### Step 1: Enable pg_cron Extensions

Run this SQL in the Supabase SQL Editor to enable the required extensions:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Step 2: Create the Cron Job

Run this SQL in the Supabase SQL Editor (NOT via migrations, as it contains project-specific values):

```sql
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

Alternative with hardcoded secret (if `current_setting` is not configured):
```sql
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_VALUE"}'::jsonb,
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

### Step 3: Update UI to Reflect Automatic Syncing

Update `ActiveMonitoring.tsx` to communicate that tracking is automatic:

**Changes:**
- Add "Background Sync Active" indicator showing the 5-minute interval
- Rename "Check Now" button to "Sync Now" 
- Update button label to clarify it forces an immediate sync
- Remove the impression that manual action is required

```text
┌──────────────────────────────────────────────┐
│ ● Tracking Active                            │
│   Background sync every 5 minutes            │
└──────────────────────────────────────────────┘

[ Sync Now ]  ← Forces immediate check
[ Pause Tracking ]
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/flows/twitter-alpha-tracker/ActiveMonitoring.tsx` | Update UI messaging for automatic syncing |

## Manual Steps Required

The user must run the cron SQL in the Supabase SQL Editor because:
1. It contains project-specific URLs and secrets
2. Cron jobs should not be in migrations (they're environment-specific)

---

## Technical Notes

- **Polling Interval**: 5 minutes matches other automation threads
- **Authentication**: Uses `x-cron-secret` header validated against `CRON_SECRET` env var
- **Rate Limits**: Multiple accounts are batched into a single Twitter API query (`from:user1 OR from:user2`) to stay within limits
- **Deduplication**: `twitter_alpha_processed_posts` table prevents duplicate memories

