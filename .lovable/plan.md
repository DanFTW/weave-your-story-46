

## Root Cause Analysis

Three distinct bugs are preventing birthday reminders from being sent:

### Bug 1: Cron Job Authentication is Broken (Critical)

The `birthday-reminder-daily` pg_cron job was created with the wrong headers. It sends a static `Authorization: Bearer <anon_key>` header, but the edge function's `cron-poll` handler checks for `x-cron-secret` and `x-cron-trigger` headers, which are absent. Every other cron job in the project (e.g., `twitter-alpha-tracker-poll`, `instagram-automation-poll`) correctly uses `jsonb_build_object` with the `x-cron-secret` pulled from `app_settings` and `x-cron-trigger: supabase-internal`.

**Result:** The daily cron always gets a 401 Unauthorized response. No birthdays are ever checked automatically.

**Fix:** Drop the existing cron job and recreate it using the same pattern as other working cron jobs.

### Bug 2: Birthday Matching Only Checks Exactly N Days Ahead (Design Flaw)

`isBirthdayInDays(birthday, daysBeforeTarget)` checks if the birthday falls on **exactly** `daysBeforeTarget` (default 7) days from now. It does not check a range. This means:
- The reminder can only fire on one specific day (7 days before the birthday)
- If the cron misses that day (which it always does, per Bug 1), the opportunity is lost
- Manual polls also fail unless run on that exact day

**Fix:** Change the logic to check if the birthday is **within the next N days** (1 to N inclusive), so reminders are sent anytime the birthday is upcoming.

### Bug 3: Regex May Not Match All Memory Formats (Robustness)

The birthday regex requires a possessive form like `"X's birthday is March 9"`. It uses `(?:'s|'s)` which handles straight and curly apostrophes but may miss other formats like:
- `"John birthday March 9"` (no apostrophe)
- `"Birthday: John - March 9"`
- `"March 9 is John's birthday"`

**Fix:** Add more flexible regex patterns and a reversed date-first pattern.

---

## Implementation Plan

### Step 1: Fix the pg_cron job

Use the Supabase SQL insert tool to:
1. Unschedule the broken `birthday-reminder-daily` job
2. Recreate it using `jsonb_build_object` with `x-cron-secret` from `app_settings` and `x-cron-trigger`, matching the pattern used by all other working cron jobs

### Step 2: Fix `isBirthdayInDays` in the edge function

Change the function to check if the birthday falls within a range of 1 to `daysAhead` days from now (inclusive), rather than exactly `daysAhead` days. This ensures the reminder fires anytime the birthday is upcoming, not just on one specific day.

### Step 3: Add more birthday parsing patterns

Add additional regex patterns to the edge function:
- Date-first: `"March 9 is X's birthday"`
- Simpler: `"X birthday March 9"` (no possessive)

### Step 4: Redeploy the edge function

Deploy the updated `birthday-reminder` function.

No frontend changes needed. No database schema changes needed.

