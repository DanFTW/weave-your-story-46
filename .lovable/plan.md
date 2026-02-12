# Todoist New Task Tracker (Event-Driven Version)

## Overview

Create a new "Todoist New Task Tracker" thread that automatically saves new Todoist tasks as memories.

Flow:

1. Connect Todoist
2. Toggle Monitoring On/Off

This follows the HubSpot Contact Tracker UI pattern exactly, but uses a **Composio event trigger (**`TODOIST_NEW_TASK_CREATED`**) instead of polling + cron**, which is the modern 2026 best practice.

---

# Registration Points (UNCHANGED)

No structural changes.

1. `src/data/threads.ts`  
Add `todoist-task-tracker` thread entry
  - icon: `CheckSquare`
  - gradient: `"orange"`
  - flowMode: `"thread"`
  - triggerType: `"automatic"`
  - integrations: `["todoist"]`
2. `src/data/threadConfigs.ts`  
3 steps:
  - Connect Todoist
  - Enable Monitoring (toggle)
  - Always-On Monitoring (LIVE badge)
3. `src/data/flowConfigs.ts`  
Add:
  ```ts
  isTodoistAutomationFlow: true

  ```
4. `src/types/flows.ts`  
Add:
  ```ts
  isTodoistAutomationFlow?: boolean

  ```
5. `src/pages/Threads.tsx`  
Add `'todoist-task-tracker'` to `flowEnabledThreads`
6. `src/pages/ThreadOverview.tsx`  
Add `'todoist-task-tracker'` to `flowEnabledThreads`
7. `src/pages/FlowPage.tsx`  
Add:
  ```tsx
  if (config.isTodoistAutomationFlow) {
    return <TodoistAutomationFlow />;
  }

  ```

---

# Frontend Components (UNCHANGED UI)

Same structure as proposed.

6. `src/types/todoistAutomation.ts`  
Types:
  - `TodoistAutomationPhase`
  - `TodoistAutomationConfig`
  - `TodoistTaskStats`
  - `TodoistAutomationUpdatePayload`
7. `src/hooks/useTodoistAutomation.ts`  
Phases:
  - `auth-check`
  - `configure`
  - `activating`
  - `active`
  Handles:
  - Load config
  - Activate
  - Deactivate
  - No manual polling
8. `src/components/flows/todoist-automation/`
  - `TodoistAutomationFlow.tsx`
  - `AutomationConfig.tsx`
  - `ActiveMonitoring.tsx`
  - `ActivatingScreen.tsx`
  - `index.ts`

UI identical to HubSpot automation pattern.

---

# Database (Slightly Simplified)

## 10. `todoist_automation_config`

Keep:

- `id` UUID PK
- `user_id` UUID FK
- `monitor_new_tasks` BOOLEAN DEFAULT true
- `is_active` BOOLEAN DEFAULT false
- `trigger_id` TEXT ← now REQUIRED for event system
- `tasks_tracked` INTEGER DEFAULT 0
- `created_at`
- `updated_at`

Remove:

- ❌ `last_polled_at` (no polling anymore)

RLS on `user_id`  
`update_updated_at_column` trigger

---

## 11. `todoist_processed_tasks`

UNCHANGED:

- `id`
- `user_id`
- `todoist_task_id`
- `processed_at`
- UNIQUE(user_id, todoist_task_id)
- RLS on `user_id`

This still protects against duplicate event deliveries.

---

# Edge Function (MAJOR CHANGE)

## 12. `supabase/functions/todoist-automation-triggers/index.ts`

Now handles:

### activate

- Calls Composio to create a trigger:
  ```
  TODOIST_NEW_TASK_CREATED

  ```
- Pass:
  - connected_account_id
  - webhook URL (this edge function endpoint)
- Store returned `trigger_id` in `todoist_automation_config`
- Set `is_active = true`

---

### deactivate

- Delete Composio trigger using stored `trigger_id`
- Set `is_active = false`
- Null out `trigger_id`

---

### webhook-handler (NEW)

This is the endpoint Composio calls when a new task is created.

Flow:

1. Verify webhook signature (if provided by Composio)
2. Extract:
  - user
  - task_id
  - content
  - project
  - priority
  - due
3. Check `todoist_processed_tasks`
4. If not processed:
  - Insert into `todoist_processed_tasks`
  - Create memory via LIAM API
  - Increment `tasks_tracked`

Memory format (unchanged):

```
Todoist Task Created

Task: {content}
Project: {project}
Priority: {priority}
Due: {due_date}

A new task was added to your Todoist.

```

---

## 13. `supabase/config.toml`

Still:

```
[functions.todoist-automation-triggers]
verify_jwt = false

```

But:

- Webhook route validates Composio signature
- Activate/deactivate validates user session JWT

---

# ❌ Removed Entirely

## Background Cron

❌ No `pg_cron`  
❌ No `cron-poll`  
❌ No 5-minute polling loop  
❌ No `manual-poll`  
❌ No `TODOIST_GET_ALL_TASKS`

---

# Composio Details (Updated)

- Auth Config ID: `ac_E90ichFZZyZo`
- Toolkit: `TODOIST`
- Trigger: `TODOIST_NEW_TASK_CREATED`
- Store returned `trigger_id`
- Delete trigger on deactivate

---

# Why This Version Is Better

- Real-time
- No 5-minute lag
- No cross-user polling loop
- Lower API usage
- Scales infinitely better
- Cleaner infrastructure
- Modern event-driven architecture (2026 best practice)

---

# What Did NOT Change

- Thread structure
- UI flow
- Phase logic
- File layout
- HubSpot pattern
- Styling
- Integration UX
- Memory format
- RLS design
- Deduplication logic

---