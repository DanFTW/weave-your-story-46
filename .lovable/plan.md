

## Add SMS Notifications to Bill Due Reminder

### Problem
Bills are detected and displayed but no text messages are sent. The config table lacks a `phone_number` column, the UI has no phone input, and the edge function has no SMS sending logic.

### Changes

**1. Database Migration** — Add `phone_number` column to `bill_due_reminder_config`:
```sql
ALTER TABLE public.bill_due_reminder_config ADD COLUMN phone_number text;
```

**2. `src/components/flows/bill-due-reminder/BillConfig.tsx`** — Add phone number input
- Add props: `phoneNumber`, `onPhoneChange` (managed by parent or local state)
- Add `usePhonePrefill` hook for cross-thread phone prefill (same as email-text-alert)
- Add phone input field before the activate button, matching AlertConfig pattern
- Disable activate button when phone is empty
- Pass phone number up via `onActivate(phoneNumber)`

**3. `src/hooks/useBillDueReminder.ts`** — Store phone number on activate
- Update `activate()` to accept `phoneNumber: string` parameter
- Send `{ action: "activate", phoneNumber }` to the edge function
- Map `phone_number` from config in `loadConfig`

**4. `src/types/billDueReminder.ts`** — Add `phoneNumber` to `BillDueReminderConfig`

**5. `src/components/flows/bill-due-reminder/BillDueReminderFlow.tsx`** — Pass phone through activate
- Update `handleActivate` to pass phone number from BillConfig to `activate()`

**6. `supabase/functions/bill-due-reminder/index.ts`** — Two additions:
- **Activate action**: Save `phone_number` from request body to config table
- **SMS helper** (`sendSms`): Copy exact pattern from email-text-alert (E.164 normalization, SMS gateway URL, `SMS_API_KEY` header, 502 cold-start retry)
- **Manual-sync**: After extracting each bill, compose a summary like `"Bill: Comcast — $89.99, due Apr 15"` and call `sendSms(configData.phone_number, summary)`. Only increment `billCount` on successful SMS delivery (matching email-text-alert pattern)
- Add `SMS_API_KEY` env var read at top (already exists as a Supabase secret)

### Files
| File | Action |
|------|--------|
| DB migration | Add `phone_number text` column |
| `src/types/billDueReminder.ts` | Add `phoneNumber` field |
| `src/components/flows/bill-due-reminder/BillConfig.tsx` | Add phone input + prefill |
| `src/hooks/useBillDueReminder.ts` | Pass phone on activate, map from config |
| `src/components/flows/bill-due-reminder/BillDueReminderFlow.tsx` | Wire phone through activate |
| `supabase/functions/bill-due-reminder/index.ts` | Add `sendSms`, send SMS in manual-sync, save phone on activate |

