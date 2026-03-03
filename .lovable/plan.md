

## Plan: Switch Birthday Reminder from Send to Draft Creation (Exact 7-Day Trigger)

### Changes

**1. Edge Function (`supabase/functions/birthday-reminder/index.ts`)**

- **Replace `isBirthdayInDays` range check with exact 7-day check.** New function `isBirthdayExactlyInDays(birthday, days)` checks if `today + days` matches the birthday month/day. No more 0-to-N range loop.

- **Replace `sendEmailViaComposio` with `createDraftViaComposio`.** Change the Composio tool from `GMAIL_SEND_EMAIL` to `GMAIL_CREATE_EMAIL_DRAFT`. Same payload keys (`recipient_email`, `subject`, `body`). Same fail-closed validation. Same `SendResult` return type.

- **Update `processUser` to call `createDraftViaComposio`.** Update log messages from "sent"/"Reminder sent" to "draft created". Dedup row still written on success.

- **Update `generateBirthdayEmail` prompt.** Instruct the AI that the message will be saved as a Gmail draft for the user to review and send. Emphasize referencing the contact's interests, relationship details, and shared experiences from the context memories to make it personal.

- **Update log messages and response fields** throughout the function (`remindersSent` → semantically still the same key but logs say "drafts created").

**2. UI: `AutomationConfig.tsx`**
- Step 4: "Creates a personalized birthday draft in your Gmail for you to review and send"
- Description: "compose a personalized draft" instead of "send a personalized email"

**3. UI: `ActiveMonitoring.tsx`**
- "Reminders Sent" → "Drafts Created"
- "Birthday Emails" → "Birthday Drafts"
- "Sent Reminders" → "Created Drafts"
- Empty state and per-item text updated to "draft" language

**4. Hook: `useBirthdayReminder.ts`**
- Toast messages updated: "drafts" instead of "reminders"

No database migrations needed. Existing `birthday_reminders_sent` table is reused for draft dedup tracking.

