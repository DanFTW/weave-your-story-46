

## Problem

The email automation webhook (`email-automation-webhook/index.ts`) processes incoming/outgoing emails and saves them to LIAM as memories, but never records them locally in Supabase. The `ActiveMonitoring.tsx` component only shows which contacts are being monitored — there is no email history display because there is no local data to display.

## Plan

### 1. DB Migration — create `email_automation_processed_emails` table

Create a new table to store a local record of each processed email:

```sql
CREATE TABLE public.email_automation_processed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_email TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  snippet TEXT,
  direction TEXT NOT NULL, -- 'incoming' or 'outgoing'
  email_message_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);
```

With RLS policies for authenticated users to SELECT and INSERT their own rows. The webhook uses the service role, so inserts will bypass RLS.

### 2. Update `supabase/functions/email-automation-webhook/index.ts`

After successfully saving to LIAM (around line 351-356), insert a row into `email_automation_processed_emails` with:
- `user_id` from `contact.user_id`
- `contact_email` from `contact.email_address`
- `sender` from `emailData.from`
- `subject` from `emailData.subject`
- `snippet` — first 200 chars of `emailData.body`
- `direction` — `"incoming"` or `"outgoing"`
- `email_message_id` from `emailData.messageId`

This ensures every processed email is recorded locally regardless of LIAM success.

### 3. Update `src/components/flows/email-automation/ActiveMonitoring.tsx`

Add an "Email History" section (following the Instagram analytics pattern):

- Add `useState` for `history` array and `historyLoading` boolean
- Add `useEffect` that fetches from `email_automation_processed_emails` for the current user, ordered by `processed_at desc`, limit 50
- Render a "Email History" card after the contacts list showing:
  - Direction icon (Inbox/Send)
  - Sender or recipient (bold)
  - Subject line (truncated)
  - Relative timestamp (using `formatDistanceToNow` from date-fns)
- Loading spinner and empty state included

### Files changed
- `email_automation_processed_emails` table — new DB migration
- `supabase/functions/email-automation-webhook/index.ts` — insert processed record
- `src/components/flows/email-automation/ActiveMonitoring.tsx` — email history UI

