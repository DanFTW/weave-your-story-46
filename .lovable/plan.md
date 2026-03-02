

# Auto Birthday Reminder — Implementation Plan

## Summary

A new automated thread that runs a daily cron job to scan LIAM memories for upcoming birthdays (7 days out), gathers contextual memories about each person, composes a personalized birthday email using the Lovable AI Gateway, and sends it via Composio Gmail. Deduplication prevents repeat emails.

## Architecture

```text
Daily Cron (pg_cron)
  → birthday-reminder edge function (cron-poll action)
    → LIAM API /memory/list (query: "birthday")
    → Parse dates, find birthdays 7 days away
    → For each person:
        → LIAM /memory/list (query: "{person name}")
        → Extract email address from memories
        → If no email found → skip silently
        → AI Gateway → generate personalized email body
        → Composio GMAIL_SEND_EMAIL → send email
        → Insert into birthday_reminders_sent (dedup table)
```

## What Gets Created

### 1. Database (migration)

**Table: `birthday_reminder_config`**
- `id` uuid PK
- `user_id` uuid NOT NULL
- `is_active` boolean DEFAULT true
- `reminders_sent` integer DEFAULT 0
- `last_checked_at` timestamptz
- `days_before` integer DEFAULT 7
- `created_at`, `updated_at` timestamptz

**Table: `birthday_reminders_sent`**  (deduplication)
- `id` uuid PK
- `user_id` uuid NOT NULL
- `person_name` text NOT NULL
- `birthday_date` text NOT NULL (e.g. "September 24")
- `year_sent` integer NOT NULL (e.g. 2026)
- `sent_at` timestamptz DEFAULT now()
- UNIQUE(user_id, person_name, year_sent)

RLS policies: standard `auth.uid() = user_id` pattern for SELECT, INSERT, UPDATE, DELETE on config; SELECT + INSERT on sent table. Service role used by cron.

### 2. Edge Function: `birthday-reminder/index.ts`

Actions (same pattern as twitter-alpha-tracker):

| Action | Auth | Description |
|---|---|---|
| `activate` | User JWT | Create/enable config row |
| `deactivate` | User JWT | Set is_active = false |
| `status` | User JWT | Return config + stats |
| `cron-poll` | Cron secret | Process all active users |

**Cron-poll logic:**
1. Fetch all active configs (service role)
2. For each user:
   - Get user's LIAM API keys from `user_api_keys`
   - Get Gmail connection from `user_integrations` (integration_id = 'gmail')
   - Query LIAM: `POST /memory/list` with `query: "birthday"` to find birthday memories
   - Parse each memory for patterns like `"{Name}'s birthday is {Month} {Day}"`
   - Check if birthday is exactly 7 days from today
   - Check `birthday_reminders_sent` for dedup (person_name + current year)
   - For each upcoming birthday person:
     a. Query LIAM: `POST /memory/list` with `query: "{person name}"` to gather context
     b. Look for email pattern: `"{Name}'s email is {email}"`  — skip if not found
     c. Call Lovable AI Gateway to compose a personalized birthday email using gathered memories
     d. Send via Composio `GMAIL_SEND_EMAIL` tool
     e. Insert into `birthday_reminders_sent`
     f. Increment `reminders_sent` counter

### 3. Frontend Files

**`src/data/threads.ts`** — Add entry:
```ts
{
  id: "birthday-reminder",
  title: "Auto Birthday Reminder",
  description: "Automatically send personalized birthday emails 7 days before",
  icon: Gift, // from lucide-react
  gradient: "purple",
  status: "active",
  type: "automation",
  category: "personal",
  integrations: ["gmail"],
  triggerType: "automatic",
  flowMode: "thread",
}
```

**`src/data/threadConfigs.ts`** — Add overview steps config (connect Gmail, enable, always-on pattern).

**`src/data/flowConfigs.ts`** — Add flow config with `isBirthdayReminderFlow: true`.

**`src/types/flows.ts`** — Add `isBirthdayReminderFlow?: boolean`.

**`src/types/birthdayReminder.ts`** — Phase type, config interface, stats interface.

**`src/hooks/useBirthdayReminder.ts`** — Hook following useHubSpotAutomation pattern (activate, deactivate, status, loadConfig).

**`src/components/flows/birthday-reminder/`**:
- `BirthdayReminderFlow.tsx` — Main flow (auth-check → configure → activating → active), same structure as HubSpotAutomationFlow
- `AutomationConfig.tsx` — Toggle for days_before, activate button
- `ActiveMonitoring.tsx` — Stats display (reminders sent, last checked)
- `ActivatingScreen.tsx` — Transition animation
- `index.ts` — Barrel export

**`src/pages/FlowPage.tsx`** — Add conditional render for `isBirthdayReminderFlow`.

**`src/pages/Threads.tsx`** + **`src/pages/ThreadOverview.tsx`** — Add `'birthday-reminder'` to `flowEnabledThreads` array.

### 4. pg_cron Job (via SQL insert tool)

Daily at 8:00 AM UTC, calling the edge function with cron-poll action + cron secret from `app_settings`, same pattern as existing automation crons.

### 5. Config Updates

**`supabase/config.toml`** — Add `[functions.birthday-reminder]` with `verify_jwt = false`.

## Technical Decisions

- **LIAM semantic search** for birthday discovery — query "birthday" returns all birthday-related memories. Parse with regex for `{Name}'s birthday is {Month} {Day}` patterns.
- **7-day lookahead** with year-based dedup — only one email per person per year.
- **AI-generated email** via Lovable AI Gateway (same pattern as `generate-memories` edge function) for personalization using gathered context memories.
- **Gmail send via Composio** `GMAIL_SEND_EMAIL` tool execution, reusing the existing connected account lookup from `user_integrations`.
- **Batch processing** with 500ms delays between sends (same as twitter-alpha-tracker) to avoid rate limits.

