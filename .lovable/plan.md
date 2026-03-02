

## Current Status

The edge function is deployed and all frontend components are in place, but two critical backend pieces are missing:

1. **Database tables** (`birthday_reminder_config` and `birthday_reminders_sent`) were never created — the migration failed earlier and the tables don't exist yet.
2. **pg_cron job** was never scheduled.

Both `pg_cron` and `pg_net` extensions are already enabled.

## What Needs to Happen

### Step 1: Create the database tables + RLS policies

Run a migration to create:
- `birthday_reminder_config` (user settings: `is_active`, `days_before`, `reminders_sent`, `last_checked_at`)
- `birthday_reminders_sent` (dedup table with unique constraint on `user_id, person_name, year_sent`)
- Standard `auth.uid() = user_id` RLS policies on both
- `updated_at` trigger on config table

### Step 2: Schedule the pg_cron job

Insert the daily cron job (`0 8 * * *`) that calls the `birthday-reminder` edge function with `cron-poll` action, using the existing `CRON_SECRET` and `SUPABASE_ANON_KEY` pattern. This will use the Supabase SQL insert tool (not a migration) since it contains project-specific URLs.

### Step 3: Update generated types

The `src/integrations/supabase/types.ts` file will auto-update once tables are created, removing the need for `as any` casts in `useBirthdayReminder.ts`.

No frontend or edge function changes needed — those are already complete.

