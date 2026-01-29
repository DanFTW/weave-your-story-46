
# Insert Cron Secret for Twitter Alpha Tracker

## Action Required

Insert the provided cron secret into the `app_settings` table so the background polling can authenticate successfully.

## SQL to Execute

```sql
INSERT INTO public.app_settings (key, value) 
VALUES ('cron_secret', '7ubt7SweVFqJ9O2Rf7CUW_EW05Z91fFS4tBXOeYhxIo')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## What This Does

| Before | After |
|--------|-------|
| `app_settings` table is empty | Contains the cron secret |
| Cron job sends empty `x-cron-secret` header | Cron job sends valid secret |
| Edge function rejects with "Invalid or missing secret" | Edge function accepts and processes |

## Expected Result

Within 1 minute of execution:
- Edge function logs will show "Starting background sync..." instead of errors
- New tweets from tracked accounts will be automatically detected
- Memories will be created from monitored posts

## No Manual Steps Required

Everything will be automated after this insert.
