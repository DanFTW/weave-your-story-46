

## Analysis

The current `isBirthdayInDays` function checks days 1 through `daysAhead` (inclusive), meaning it never checks day 0 (today). The user wants:

1. Standard flow: birthdays 1-7 days ahead get a reminder (already works after previous fix)
2. Same-day flow: if a birthday is **today** (day 0), the reminder should also be sent immediately when the cron or manual poll runs

The fix is simple: change the loop in `isBirthdayInDays` to start from `d = 0` instead of `d = 1`. This makes it check today through 7 days ahead, covering both the standard advance-reminder case and the same-day case.

No other changes needed. The deduplication table (`birthday_reminders_sent`) already prevents duplicate sends within the same year, so a birthday added today will get one email sent and won't be re-sent on subsequent polls.

## Plan

### Step 1: Update `isBirthdayInDays` in the edge function

In `supabase/functions/birthday-reminder/index.ts`, change line 143 from `for (let d = 1; d <= daysAhead; d++)` to `for (let d = 0; d <= daysAhead; d++)`. This includes today (day 0) in the matching window.

### Step 2: Redeploy the edge function

Deploy the updated `birthday-reminder` function.

### Files changed
- `supabase/functions/birthday-reminder/index.ts` — one line change in `isBirthdayInDays`

