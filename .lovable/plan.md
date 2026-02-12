# Fireflies Transcript Tracker Thread — Final Plan (Webhook-Based, No Polling)

## Overview

Add a new **“Fireflies Transcript Tracker”** thread on `/threads` that saves **each new Fireflies transcript** as a memory **automatically**.

Flow is exactly:

1. **Connect to Fireflies**
2. **Transcript Monitoring Toggle (On/Off)**

When monitoring is ON, the UI provides the user a **Webhook URL + Secret** to paste into Fireflies Developer Settings → Webhook → “Transcription Completed”.

---

## Architecture (NO POLLING)

1. User connects Fireflies via existing Composio OAuth (no change to existing Fireflies connect flow)
2. User toggles **Transcript Monitoring** ON
3. We generate/store a **webhook token + webhook secret**
4. User pastes:
  - **Webhook URL** (includes token)
  - **Secret key**  
  into Fireflies Developer Settings and enables “Transcription Completed”
5. Fireflies POSTs events to our **public** webhook edge function
6. Webhook edge function:
  - verifies signature
  - dedupes by transcript id
  - fetches full transcript details via Composio Fireflies tool execution
  - saves memory via LIAM API
  - updates stats

✅ No pg_cron  
✅ No background polling  
✅ Event-driven + idempotent

---

## Database Changes

### 1) `fireflies_automation_config`

**Purpose:** per-user monitoring state + webhook credentials.

Fields:

- `id` uuid PK
- `user_id` uuid FK auth.users **UNIQUE**
- `is_active` boolean default false
- `webhook_token` text **UNIQUE** (random; used in webhook URL)
- `webhook_secret` text (shared secret for signature verification)
- `transcripts_saved` integer default 0
- `last_received_at` timestamptz nullable
- `created_at` / `updated_at` timestamptz

> Notes:

- **Remove** polling-specific fields (`trigger_id`, `last_polled_at`, “tracked”) — replaced by webhook equivalents.

### 2) `fireflies_processed_transcripts`

**Purpose:** idempotency / dedupe.

Fields:

- `id` uuid PK
- `user_id` uuid FK auth.users
- `fireflies_transcript_id` text
- `created_at` timestamptz
- Unique constraint on `(user_id, fireflies_transcript_id)`

### RLS

- Enable RLS on both tables
- Policies mirror your existing automation tables:
  - user can `select/insert/update` their own `fireflies_automation_config`
  - user can `select` their own processed rows (optional)
  - webhook edge function uses **service role** (bypasses RLS)

---

## Edge Functions

### A) `supabase/functions/fireflies-webhook/index.ts` (NEW)

**Public endpoint** that Fireflies calls.

**Important:**

- Set to **no-verify-jwt** (Fireflies won’t send Supabase auth)
- Security comes from:
  1. `webhook_token` in URL
  2. signature verification using `webhook_secret`
  3. idempotency table

**Route**

- `POST /fireflies-webhook/{token}` (preferred)
  - token maps to one user config row

**Logic**

1. Parse `{token}` from path
2. Look up config by `webhook_token`
  - if not found → 404
  - if `is_active=false` → 204 (ignore)
3. Verify signature header against raw body using `webhook_secret`
  - if invalid → 401
4. Parse payload → extract `meetingId` (treat as transcript id)
5. Attempt insert into `fireflies_processed_transcripts`
  - if conflict → 200 OK early (duplicate delivery)
6. Fetch transcript details via Composio using the user’s connected Fireflies account
7. Format memory payload (title/date/duration/participants/summary + link/id)
8. Save memory via existing LIAM memory function (use existing batch helper if present)
9. Update config:
  - `transcripts_saved += 1`
  - `last_received_at = now()`

**Separation of concerns inside the function**

- `verifyFirefliesSignature(rawBody, secret, header)`
- `getAutomationConfigByToken(token)`
- `fetchTranscriptViaComposio(userId, meetingId)`
- `formatTranscriptAsMemory(transcript)`
- `saveMemoryToLiam(memory)`
- `markTranscriptProcessed(userId, meetingId)`

---

### B) `supabase/functions/fireflies-automation-triggers/index.ts` (REPURPOSE, NO POLLING)

Keep the name to match existing patterns, but **remove “poll” behavior**.

**Authenticated function** (normal user session) used by the UI toggle.

Actions:

- `activate`
  - ensures config row exists
  - generates `webhook_token` + `webhook_secret` if missing (or rotates if requested)
  - sets `is_active=true`
  - returns:
    - `webhookUrl` (constructed from project ref + token)
    - `webhookSecret`
- `deactivate`
  - sets `is_active=false`
  - returns success

✅ No pg_cron  
✅ No “manual-poll”  
✅ No periodic checks

---

## Frontend Implementation

### 1) Types: `src/types/firefliesAutomation.ts`

- Config + phase types similar to Todoist automation, but fields match webhook config
- `FirefliesAutomationPhase`: `auth-check | configure | active | activating`

### 2) Hook: `src/hooks/useFirefliesAutomation.ts`

Mirrors structure of `useTodoistAutomation`, but:

- no polling actions
- calls `fireflies-automation-triggers` with `activate/deactivate`
- loads config from `fireflies_automation_config`
- exposes `webhookUrl`, `webhookSecret`, `isActive`, stats

### 3) Flow Components: `src/components/flows/fireflies-automation/`

Keep same layout and styling patterns as other `/threads` flows.

Files:

- `FirefliesAutomationFlow.tsx`
  - checks Composio auth for `FIREFLIES`
  - Step 1: connect (same redirect behavior as others)
  - Step 2: toggle UI + webhook setup panel when ON
- `AutomationConfig.tsx`
  - Toggle (Off/On)
  - When user turns ON: call `activate` → show URL/secret
- `ActiveMonitoring.tsx`
  - Shows:
    - status: Active
    - transcripts_saved
    - last_received_at
    - **Webhook URL** + copy
    - **Secret** + copy (with show/hide)
    - short instruction: “Paste these into Fireflies → Developer Settings → Webhook → Transcription Completed”
  - Button: Pause (deactivate)
- `ActivatingScreen.tsx`
- `index.ts`

**Design constraints**

- Do NOT hardcode Fireflies purple unless your existing threads do brand accent overrides.
- Reuse existing button/input components + spacing tokens used by Todoist thread.

---

## Thread + Flow Wiring (Minimal)

### `src/data/threads.ts`

Add:

```ts
{
  id: "fireflies-tracker",
  title: "Fireflies Transcript Tracker",
  description: "Automatically save new meeting transcripts as memories",
  icon: Mic,
  gradient: "purple",
  status: "active",
  type: "automation",
  category: "productivity",
  integrations: ["fireflies"],
  triggerType: "automatic",
  flowMode: "thread",
}

```

### `src/data/threadConfigs.ts`

**2 steps only**:

1. Connect Fireflies
2. Transcript Monitoring Toggle (On/Off)

### `src/data/flowConfigs.ts`

Add flow config with `isFirefliesAutomationFlow: true`

### `src/types/flows.ts`

Add:

- `isFirefliesAutomationFlow?: boolean`

### `src/pages/Threads.tsx`

Add `"fireflies-tracker"` to `flowEnabledThreads`

### `src/pages/ThreadOverview.tsx`

Add `"fireflies-tracker"` to `flowEnabledThreads` in `handleGetStarted`

### `src/pages/FlowPage.tsx`

- import `FirefliesAutomationFlow`
- render when `isFirefliesAutomationFlow`

### `src/components/ThreadCard.tsx`

If needed, add `fireflies` gradient mapping ONLY if your thread cards require it.

---

## Migration

Single SQL migration:

- create both tables
- add constraints
- enable RLS + policies
- timestamps trigger if your project uses one

---

## QA Checklist (Must Pass)

1. Connect Fireflies → flow reaches Step 2
2. Toggle ON → returns webhook URL + secret (stable)
3. Paste into Fireflies Developer Settings + enable “Transcription Completed”
4. New transcript created → webhook hits → exactly **one** memory saved
5. Duplicate delivery of same webhook → **no duplicate memory**
6. Invalid signature → 401 and no memory saved
7. Toggle OFF → webhook events ignored (204) and nothing saved

---

## Scope Guardrails

- No pg_cron
- No polling triggers
- No changes to unrelated integrations/threads/components
- Only adds the Fireflies thread + webhook receiver + minimal wiring