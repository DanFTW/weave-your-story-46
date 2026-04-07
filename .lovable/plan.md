# Email to Text Alert Thread

## Overview

A new thread that monitors Gmail for emails matching user-configured rules (sender filter, keyword filter) and generates an LLM summary for each match. The summary and phone number are logged (SMS sending wired up separately later).

## Architecture

Follows the **email-receipt-sheet** pattern exactly: config table, processed-emails dedup table, hook, flow component, edge function with action-based routing.

text

```text
Thread Card → FlowPage → EmailTextAlertFlow component
                              ↓
                        useEmailTextAlert hook
                              ↓
                     email-text-alert edge function
                        (activate / deactivate / manual-sync)
                              ↓
                     GMAIL_FETCH_EMAILS → LLM summarize → log
```

## Files to Create

### 1. Database Migration

Two new tables:

`email_text_alert_config` — one row per user

- `id` uuid PK, `user_id` uuid (references auth.users), `is_active` boolean default false
- `sender_filter` text (comma-separated emails/domains), `keyword_filter` text (comma-separated keywords)
- `phone_number` text, `created_at`, `updated_at`
- RLS: users can CRUD their own rows

`email_text_alert_processed` — dedup table

- `id` uuid PK, `user_id` uuid, `email_message_id` text
- `summary` text, `created_at`
- Unique constraint on `(user_id, email_message_id)`
- RLS: users can read/insert their own rows

### 2. `src/types/emailTextAlert.ts`

Phase type (`auth-check | configure | activating | active`), config interface, stats interface.

### 3. `src/hooks/useEmailTextAlert.ts`

Mirrors `useEmailReceiptSheet`: loadConfig, activate, deactivate, manualSync. Config includes sender_filter, keyword_filter, phone_number.

### 4. `src/components/flows/email-text-alert/`

- `EmailTextAlertFlow.tsx` — Main flow component. Checks Gmail connection via `useComposio('GMAIL')`, redirects to `/integration/gmail` if not connected. Renders configure or active phase.
- `AlertConfig.tsx` — "How it works" card + form fields: sender filter input, keyword filter input, phone number input. Activate button.
- `ActiveMonitoring.tsx` — Toggle on/off, shows config summary, "Sync now" button, stats (alerts sent count).
- `ActivatingScreen.tsx` — Simple loading screen shown during activation.
- `index.ts` — barrel export

### 5. `supabase/functions/email-text-alert/index.ts`

Action-based edge function:

- **activate**: sets `is_active = true`
- **deactivate**: sets `is_active = false`
- **update-config**: updates sender_filter, keyword_filter, phone_number
- **manual-sync**:
  1. Get Gmail connection from `user_integrations` (read the `composio_connection_id` — the `ca_*` value)
  2. Build GMAIL_FETCH_EMAILS query from sender_filter and keyword_filter
  3. Fetch emails using Composio v3 with `connected_account_id` set to the `ca_*` value from step 1 (not the auth config ID)
  4. Dedup against `email_text_alert_processed`
  5. For each new match, call LLM to generate short summary
  6. Insert into `email_text_alert_processed` with summary
  7. Log: `console.log(\`[TextAlert] Would send SMS to ${phoneNumber}: ${summary`)`
  8. Return count of new alerts

### 6. Registration (existing files to edit)

- `src/data/threads.ts` — Add thread entry with `id: "email-text-alert"`, `icon: Mail`, `gradient: "orange"`, `integrations: ["gmail"]`, `flowMode: "thread"`
- `src/data/threadConfigs.ts` — Add thread config with steps (Connect Gmail, Configure Rules, Active Monitoring)
- `src/data/flowConfigs.ts` — Add flow config with `isEmailTextAlertFlow: true`
- `src/types/flows.ts` — Add `isEmailTextAlertFlow?: boolean`
- `src/pages/FlowPage.tsx` — Add conditional render for `config.isEmailTextAlertFlow`
- `src/pages/Threads.tsx` — Add `'email-text-alert'` to `flowEnabledThreads`

## Technical Details

- Gmail auth config `ac_IlbziSKZknmH` is used in `composio-connect` when creating the connection. The edge function reads the resulting `composio_connection_id` (the `ca_*` value) from `user_integrations` and passes that as `connected_account_id` when executing Composio tool calls.
- Gmail query built dynamically: `from:sender1 OR from:sender2` combined with keyword terms
- LLM summarization uses the same LOVABLE_API_KEY pattern from the AI gateway
- Deduplication via `email_text_alert_processed` table, same pattern as `email_receipt_sheet_processed`
- SMS sending is stubbed as a console.log — to be wired up separately