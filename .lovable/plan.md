

## Analysis

The `useBirthdayReminder` hook declares `sentReminders` state and exposes it, but never fetches data from the `birthday_reminders_sent` table. The `ActiveMonitoring` component doesn't receive or render sent reminders at all.

The `birthday_reminders_sent` table has columns: `person_name`, `birthday_date`, `year_sent`, `sent_at`, and RLS is already set up for user-owned SELECT.

## Plan

### 1. Fetch sent reminders in `useBirthdayReminder.ts`

Inside `loadConfig`, after loading the config, query `birthday_reminders_sent` for the current user ordered by `sent_at desc` and populate `setSentReminders`.

### 2. Pass sent reminders to `ActiveMonitoring`

In `BirthdayReminderFlow.tsx`, pass `sentReminders` from the hook to the `ActiveMonitoring` component.

### 3. Render sent reminders list in `ActiveMonitoring`

Add a "Sent Reminders" section below the monitoring card that lists each reminder with the person's name, birthday date, and when it was sent. Show an empty state if none exist.

### Files changed
- `src/hooks/useBirthdayReminder.ts` — add query for `birthday_reminders_sent`
- `src/components/flows/birthday-reminder/ActiveMonitoring.tsx` — accept and render `sentReminders`
- `src/components/flows/birthday-reminder/BirthdayReminderFlow.tsx` — pass `sentReminders` prop

