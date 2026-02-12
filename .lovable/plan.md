# ✅ FINAL APPROVAL PLAN

# Fix: Todoist Activation Failure (Polling via Composio Tool)

---

## Root Cause (Confirmed)

The Composio `TODOIST_NEW_TASK_CREATED` trigger is broken due to reliance on Todoist’s deprecated Sync API v8. This results in:

```
TriggerInstance_PollingConfigInvalid (1213)

```

This is a provider-side issue and cannot be fixed within our system.

Because users authenticate through Composio’s OAuth app, we cannot register native Todoist webhooks ourselves.

Therefore, webhook-based monitoring is not viable at this time.

---

# ✅ Correct Architectural Solution

Switch from trigger-based monitoring to **polling via Composio’s** `TODOIST_GET_ALL_TASKS` **tool**, not via direct Todoist REST API calls.

This preserves:

- Proper OAuth abstraction
- Composio token lifecycle management
- Clean separation of concerns
- Minimal code surface change

We will not extract or use raw access tokens.

---

# Scope of Changes (Strictly Limited)

Only the following areas will change.

Nothing else.

---

# 1️⃣ Database Migration

### Add back `last_polled_at` to:

```
todoist_automation_config

```

```sql
ALTER TABLE todoist_automation_config
ADD COLUMN last_polled_at TIMESTAMPTZ;

```

No other schema changes.

---

# 2️⃣ Edge Function Rewrite

`supabase/functions/todoist-automation-triggers/index.ts`

Remove:

- All trigger creation logic
- All Composio trigger registration calls
- All webhook logic

Replace with 3 clean actions:

---

## `activate`

- Set `is_active = true`
- Immediately execute internal poll (same logic as manual-poll)
- Return number of new tasks processed

No Composio trigger creation.

---

## `deactivate`

- Set `is_active = false`
- No external calls

---

## `manual-poll`

### Flow:

1. Fetch user's Composio `connected_account_id`
2. Execute:

```
POST https://backend.composio.dev/api/v3/tools/execute/TODOIST_GET_ALL_TASKS

```

Body:

```json
{
  "connected_account_id": "...",
  "arguments": {}
}

```

3. Receive task list
4. For each task:
  - Check `todoist_processed_tasks`
  - If not exists:
    - Insert into `todoist_processed_tasks`
    - Create LIAM memory
5. Update:
  - `tasks_tracked`
  - `last_polled_at`

---

## Memory Format (Unchanged)

```
Todoist Task Created

Task: {content}
Project: {project}
Priority: {priority}
Due: {due_date}

A new task was added to your Todoist.

```

No format changes.

---

# 3️⃣ Frontend Hook Update

`src/hooks/useTodoistAutomation.ts`

Changes:

### After successful activation:

Immediately call `manual-poll`

Expose:

```
manualPoll()

```

Return updated stats in state.

No phase logic changes.  
No UI redesign.

---

# 4️⃣ ActiveMonitoring Component

`src/components/flows/todoist-automation/ActiveMonitoring.tsx`

- Wire "Check Now" → `manualPoll`
- Display:
  - `tasksTracked`
  - `lastPolledAt`

No visual redesign.  
No layout changes.  
No extra UI elements.

---

# What Does NOT Change

- Thread registration
- flowConfigs
- threadConfigs
- FlowPage
- TodoistAutomationFlow
- AutomationConfig
- ActivatingScreen
- Types
- RLS policies
- Deduplication logic
- Memory format
- Integration connection flow

---

# Architecture After Fix

```
User clicks Activate
   ↓
Edge function sets is_active = true
   ↓
Edge function calls Composio TODOIST_GET_ALL_TASKS
   ↓
Dedup
   ↓
Create memories
   ↓
Update stats

```

Manual Poll:

```
Check Now
   ↓
Edge function
   ↓
Composio tool
   ↓
Dedup
   ↓
Update stats

```

No triggers.  
No webhooks.  
No OAuth leakage.  
No deprecated APIs.

---

# Why This Is Correct (2026 Best Practice)

- Maintains third-party abstraction boundary
- Avoids raw token handling
- Modular
- Idempotent
- Minimal blast radius
- Clean rollback path
- Production-safe

---

# ✅ Final Decision

Approve this revised plan.

It fixes the activation error.  
It avoids broken Composio triggers.  
It does not compromise architecture.  
It does not introduce technical debt.