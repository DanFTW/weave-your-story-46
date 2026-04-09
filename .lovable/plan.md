
What I found

- The frontend path is already wired correctly:
  - `useEmailTextAlert.ts` selects `sender_email` and `subject` from `email_text_alert_processed`
  - it maps them to `senderEmail` and `subject`
  - `AlertCard.tsx` already renders both fields
  - `ActiveMonitoring.tsx` already passes the alert objects through the outer “Alerts sent” collapsible

- The actual break is in the stored data:
  - I checked `email_text_alert_processed`
  - all 17 current rows have `sender_email = null` and `subject = null`
  - those rows were created on 2026-04-07, which is before the migration that added those columns on 2026-04-09
  - so the UI has nothing to display for existing alerts

- The edge function has been updated to write metadata, but its extraction is still weaker than the project’s other Gmail ingestion code:
  - current logic only uses `email.sender ?? email.from` and `email.subject`
  - elsewhere in the codebase, Gmail data is normalized with safer fallbacks like:
    - sender: `from || From || sender`
    - subject: `subject || Subject || snippet.subject || "(No subject)"`

Why it still appears broken

1. Existing alert records are legacy rows with null metadata
2. The frontend is faithfully rendering those nulls
3. Even for future rows, the edge function should use the stronger Gmail field normalization pattern to avoid more null metadata when Composio returns alternate shapes

Fix plan

1. Harden metadata extraction in `supabase/functions/email-text-alert/index.ts`
- Add small helper functions for Gmail message normalization
- Extract sender using the same fallback pattern already used in `gmail-fetch-emails` and `email-automation-triggers`
- Extract subject using `subject`, `Subject`, and `snippet.subject` fallback
- Keep the summary/body logic separate so the function stays modular

2. Repair existing history rows
- Add a backfill path to the same edge function, e.g. `action: "repair-history"`
- It should:
  - load the user’s recent `email_text_alert_processed` rows where sender/subject are missing
  - fetch recent Gmail matches using the existing query builder + Composio fetch
  - map fetched messages by `email_message_id`
  - update only rows missing metadata for the authenticated user
- This keeps repair logic close to the ingestion logic and avoids duplicating Gmail parsing elsewhere

3. Surface repair from the hook
- Add a dedicated hook method like `repairAlertHistory()`
- Call it after manual sync when the loaded alerts still contain missing sender/subject values, or expose it as an explicit maintenance step from the flow
- Prefer a separate function over baking repair into render-time loading

4. Keep UI changes minimal
- No major UI redesign needed
- Optionally show a fallback label only when metadata is missing, but the primary fix is data repair, not presentation
- Preserve the current modular split:
  - edge function owns Gmail parsing + persistence
  - hook owns loading/sync/repair orchestration
  - card owns display only

5. Validate the full path after implementation
- Confirm new syncs write `sender_email` and `subject`
- Confirm repaired legacy rows now populate cards
- Confirm cards show sender + subject immediately without additional UI changes

Files to update
- `supabase/functions/email-text-alert/index.ts`
- `src/hooks/useEmailTextAlert.ts`
- possibly `src/components/flows/email-text-alert/EmailTextAlertFlow.tsx` only if a repair action needs to be triggered from the screen

Technical note
- No schema change is needed; the columns already exist
- No frontend display bug was found in the current card implementation
- The root issue is legacy null data plus insufficiently defensive metadata extraction for future inserts
