

## Add Alert History to Email Text Alert

### Problem
The `email_text_alert_processed` table only stores `email_message_id` and `summary` — no sender or subject metadata. We need to add columns, update the edge function to populate them, create an alert card component, and wire up loading + deletion.

### Changes

**1. Database Migration** — Add columns to `email_text_alert_processed`
- Add `sender_email text`, `subject text` columns (nullable, for backward compat)
- Add DELETE RLS policy for authenticated users (matching weekly-event-finder pattern)

**2. Edge Function: `supabase/functions/email-text-alert/index.ts`**
- When inserting into `email_text_alert_processed` (line ~317), also store `sender_email` and `subject` extracted from the email object

**3. New Type: `src/types/emailTextAlert.ts`**
- Add `ProcessedAlert` interface: `{ id, emailMessageId, senderEmail, subject, summary, createdAt }`

**4. New Component: `src/components/flows/email-text-alert/AlertCard.tsx`**
- `forwardRef` component matching `FoundEventCard` pattern exactly
- Props: `alert: ProcessedAlert`, `onDelete?: (id: string) => Promise<void>`
- Collapsed: Mail icon, subject (or sender) as title, relative timestamp as subtitle
- Expanded: sender email, full summary text, delete button with loading state
- Same styling: `bg-card rounded-2xl border border-border`, `text-destructive` delete

**5. Hook: `src/hooks/useEmailTextAlert.ts`**
- Add `alerts` state (`ProcessedAlert[]`)
- Add `loadAlerts()` — fetch 50 most recent from `email_text_alert_processed` ordered by `created_at desc`
- Add `deleteAlert(id)` — delete row, remove from local state, decrement `alertsSent` on config, toast
- Call `loadAlerts()` inside `loadConfig()` after config is loaded, and after `manualSync`
- Export `alerts` and `deleteAlert`

**6. Component: `src/components/flows/email-text-alert/ActiveMonitoring.tsx`**
- Accept `alerts: ProcessedAlert[]` and `onDeleteAlert` props
- Replace static "Alerts sent" stats card with a collapsible section (same pattern as weekly-event-finder):
  - Trigger: Bell icon, "Alerts sent (N)", ChevronDown
  - Content: map `alerts` to `AlertCard` components, or empty state message
- Add `useState(false)` for collapsible open state

**7. Flow: `src/components/flows/email-text-alert/EmailTextAlertFlow.tsx`**
- Destructure `alerts` and `deleteAlert` from hook
- Pass them to `ActiveMonitoring`

### Technical Details
- RLS: New DELETE policy uses `auth.uid() = user_id` on `email_text_alert_processed`
- The `sender_email` and `subject` columns are nullable so existing rows remain valid
- Edge function extracts sender from `email.sender` / `email.from` and subject from `email.subject`
- `AlertCard` uses `forwardRef` to avoid Radix ref warning inside `CollapsibleContent`

