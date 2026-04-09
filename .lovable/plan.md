

## Add Summary SMS + Due-Date Reminder Texts to Bill Due Reminder

### Problem
Currently, each bill triggers an individual SMS during sync. There's no consolidated overview text and no pre-due-date reminder texts (7-day and 1-day).

### Changes

**1. Database Migration** — Add reminder tracking columns to `bill_due_reminder_processed`:
```sql
ALTER TABLE public.bill_due_reminder_processed
  ADD COLUMN reminder_7d_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_1d_sent boolean NOT NULL DEFAULT false;
```

**2. Edge Function (`supabase/functions/bill-due-reminder/index.ts`)** — Three additions:

**a) Summary SMS on initial sync:**
In the `manual-sync` action, after processing all new bills, compose one consolidated SMS listing all newly detected bills (biller, amount, due date) and send it to the user's phone. Example:
```
Your bills summary:
• Comcast — $89.99, due Apr 15
• Electric Co — $120.00, due Apr 20
```
Only sent when there are new bills found in that sync run.

**b) Due-date reminder logic (`checkAndSendReminders` helper):**
- Query all `bill_due_reminder_processed` rows for a user where `due_date` is not null
- Parse each `due_date` string into a Date (use the LLM-standardized format)
- Compare to today:
  - If due date is ≤ 7 days away and `reminder_7d_sent = false` → send SMS: `"Reminder: [Biller] — [Amount] is due in 7 days ([Date])"` → set `reminder_7d_sent = true`
  - If due date is ≤ 1 day away and `reminder_1d_sent = false` → send SMS: `"Reminder: [Biller] — [Amount] is due tomorrow ([Date])"` → set `reminder_1d_sent = true`
- Call this helper at the end of `manual-sync` (so users get reminders when they sync)

**c) `cron-poll` action:**
- Add a new `cron-poll` action following the standard pattern (validate `x-cron-secret` or `x-cron-trigger: supabase-internal`)
- For each active user in `bill_due_reminder_config`, call `checkAndSendReminders`
- This ensures reminders fire automatically without manual sync
- Add `CRON_SECRET` env var read (already exists as a Supabase secret)

**3. Types (`src/types/billDueReminder.ts`)** — Add fields to `ProcessedBill`:
```typescript
reminder7dSent: boolean;
reminder1dSent: boolean;
```

**4. Hook (`src/hooks/useBillDueReminder.ts`)** — Map the new fields in `loadBills`.

### Files
| File | Action |
|------|--------|
| DB migration | Add `reminder_7d_sent`, `reminder_1d_sent` booleans |
| `supabase/functions/bill-due-reminder/index.ts` | Add summary SMS, `checkAndSendReminders`, `cron-poll` action |
| `src/types/billDueReminder.ts` | Add reminder fields to `ProcessedBill` |
| `src/hooks/useBillDueReminder.ts` | Map new fields in `loadBills` |

