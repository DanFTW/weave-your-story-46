

## Problem

The Discord tracker has no automatic background polling. Messages only sync when the user presses "Sync Now." Other active threads (Twitter Alpha Tracker, LinkedIn, Instagram) use a `cron-poll` action in their edge function plus a `pg_cron` job to auto-sync every few minutes.

The Discord edge function (`discord-automation-triggers`) currently requires user authentication for all actions — there is no `cron-poll` code path that iterates over all active users using the service role key.

## Plan — 1 file + 1 SQL insert

### 1. Add `cron-poll` action to `supabase/functions/discord-automation-triggers/index.ts`

Insert a new code block **before** the auth check (around line 117) that intercepts `action === "cron-poll"` requests. This mirrors the pattern used by `twitter-alpha-tracker`:

- Authenticate via `x-cron-secret` header (read from `app_settings` table) or `x-cron-trigger: supabase-internal`.
- Query all rows from `discord_automation_config` where `is_active = true` and `channel_id IS NOT NULL`.
- For each active config, reuse the existing poll logic: fetch last 50 messages from the channel via Bot token, apply trigger word filter, deduplicate against `discord_processed_messages`, create memories via `liam-memory`, and update `last_checked_at`.
- Return a summary JSON with users processed and messages imported.
- Skip the normal user-auth flow entirely for this code path.

### 2. Create pg_cron job (SQL insert, not migration)

Run via Supabase SQL editor — schedule the function to poll every 5 minutes:

```sql
SELECT cron.schedule(
  'discord-tracker-auto-poll',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yatadupadielakuenxui.supabase.co/functions/v1/discord-automation-triggers',
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

### What stays the same

- The existing `poll` action (manual sync) remains unchanged.
- No frontend changes needed — the UI already shows "Background Sync Active" when monitoring is on.
- No other files are modified.

