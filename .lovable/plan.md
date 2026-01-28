
# Automate Twitter Alpha Tracker Background Polling

## Problem

The user shouldn't have to manually run SQL in Supabase. The cron job for automatic polling should be set up automatically.

## Solution

Create a database migration that schedules the `pg_cron` job to call the edge function every minute. Since this is the Lovable platform, we can use the migration tool which will execute the SQL automatically.

---

## Technical Implementation

### Database Migration

Create a migration to schedule the cron job:

```sql
-- Schedule Twitter Alpha Tracker polling every minute
-- First, unschedule if exists to avoid duplicates
SELECT cron.unschedule('twitter-alpha-tracker-poll') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'twitter-alpha-tracker-poll');

-- Schedule the job
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdGFkdXBhZGllbGFrdWVueHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Nzg1NzksImV4cCI6MjA4NDE1NDU3OX0.G6MyJfGjhzfTVEzJA5OVSNY4c41oWGhDUf__mJ5-g9Y',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

**Issue:** The `current_setting('app.settings.cron_secret')` won't work because CRON_SECRET is an edge function environment variable, not a Postgres setting.

### Alternative Approach: Remove x-cron-secret Requirement

Instead of requiring a secret header, we can modify the edge function to accept cron requests authenticated via a different mechanism:

1. **Use internal service role auth** - The cron job can use the service role key (but this is sensitive)
2. **Use a database flag** - Check if request comes from `cron-poll` action and validate via internal IP or other mechanism
3. **Store CRON_SECRET in Vault** - Query it from Postgres and include in the request

The cleanest approach is to **store the CRON_SECRET in Postgres** so the cron job can access it.

---

## Recommended Implementation

### Step 1: Create a settings table to store the cron secret

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow service role
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- No public access policy - only service role can read
```

### Step 2: Insert the CRON_SECRET value

After the migration, the system will need to insert the secret value. This is a one-time setup.

### Step 3: Update the cron job to query the secret

```sql
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM app_settings WHERE key = 'CRON_SECRET')
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Simplified Alternative

Since the edge function already has security via the `x-cron-secret` check, and this is for internal use only, we can:

1. **Add an `internal-cron-poll` action** that doesn't require the secret but only responds to requests from localhost/internal sources
2. Or **use service role authentication** for cron requests instead of the custom secret

### Recommended: Use Service Role for Cron Auth

Modify the edge function to allow cron polls with service role auth:

**Edge Function Change:**
```typescript
// Allow cron-poll with either x-cron-secret OR service role auth
if (action === 'cron-poll') {
  const cronSecret = req.headers.get('x-cron-secret');
  const authHeader = req.headers.get('Authorization');
  
  // Check for cron secret OR service role
  const isValidCronSecret = cronSecret === CRON_SECRET;
  const isServiceRole = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  
  if (!isValidCronSecret && !isServiceRole) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  // ... rest of cron-poll logic
}
```

**Cron Job SQL:**
```sql
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

Wait - this won't work either because we can't embed the service role key in the SQL.

---

## Final Recommended Approach

The most practical solution is to **use the database to store the cron secret** and have the cron job query it dynamically:

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/twitter-alpha-tracker/index.ts` | No change needed - already supports x-cron-secret |
| New migration | Create `app_settings` table and cron job |

### Migration SQL

```sql
-- Create settings table for storing secrets accessible to pg_cron
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secure the table - no public access
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no policies = no public access)
COMMENT ON TABLE public.app_settings IS 'Internal app settings for background jobs';

-- Schedule the cron job (will be updated with secret after user sets it)
SELECT cron.schedule(
  'twitter-alpha-tracker-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/twitter-alpha-tracker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', COALESCE((SELECT value FROM public.app_settings WHERE key = 'cron_secret'), '')
    ),
    body := '{"action": "cron-poll"}'::jsonb
  ) AS request_id;
  $$
);
```

### One-Time Secret Setup

After the migration, insert the CRON_SECRET value:
```sql
INSERT INTO public.app_settings (key, value) 
VALUES ('cron_secret', 'YOUR_ACTUAL_CRON_SECRET_VALUE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

This separation means:
1. The migration creates the structure and cron job
2. The secret insertion is a one-time operation (or can be automated if we know the value)

---

## Summary

1. **Create migration** with `app_settings` table and cron job
2. **Insert CRON_SECRET** into `app_settings` table (one-time setup, can be done via SQL editor or a setup edge function)
3. **Cron job runs every minute** automatically calling the edge function

The user only needs to provide their CRON_SECRET value once, and everything else is automated.
