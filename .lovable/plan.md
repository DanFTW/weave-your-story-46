

## Bill Due Reminder Thread — Implementation Plan

### Overview
Create a new "Bill Due Reminder" thread that scans Gmail for bill/payment/due notifications, extracts biller name, amount, and due date via LLM, saves each as a LIAM memory with tag `BILL`, and displays detected bills in a collapsible history section. The flow mirrors the email-text-alert structure: Gmail auth → toggle on/off → active monitoring with sync.

### Files to Create

**1. `src/types/billDueReminder.ts`** — Types
- `BillDueReminderPhase`: `"auth-check" | "configure" | "activating" | "active"`
- `BillDueReminderConfig`: id, userId, isActive, billsFound, createdAt, updatedAt
- `BillDueReminderStats`: billsFound, isActive
- `ProcessedBill`: id, emailMessageId, billerName, amountDue, dueDate, subject, createdAt

**2. `src/hooks/useBillDueReminder.ts`** — Hook (mirrors `useEmailTextAlert`)
- State: phase, config, bills[], isLoading, isActivating, isSyncing
- `loadBills(userId)` — fetch from `bill_due_reminder_processed` table
- `loadConfig()` — fetch/create `bill_due_reminder_config` row, set phase
- `activate()` / `deactivate()` — invoke edge function
- `manualSync()` — invoke edge function `manual-sync` action
- `deleteBill(id)` — delete from processed table, decrement count

**3. `src/components/flows/bill-due-reminder/BillDueReminderFlow.tsx`** — Main flow component (mirrors `EmailTextAlertFlow`)
- Gmail auth check via `useComposio("GMAIL")`
- Sets `gmailConnectIntent: "bill-due-reminder"` + `returnAfterGmailConnect: "/flow/bill-due-reminder"` before navigating (intent guard pattern)
- Cleanup in `handleBack`
- Renders `BillConfig` or `ActiveMonitoring` based on phase

**4. `src/components/flows/bill-due-reminder/BillConfig.tsx`** — Configure screen
- Simple "How it works" card explaining bill scanning
- Activate button (no sender/keyword config needed — uses fixed bill keywords)

**5. `src/components/flows/bill-due-reminder/ActiveMonitoring.tsx`** — Active state (mirrors email-text-alert `ActiveMonitoring`)
- Toggle card (on/off switch)
- Collapsible "Bills found" history section with `BillCard` components
- "Sync now" button
- "Pause" button

**6. `src/components/flows/bill-due-reminder/BillCard.tsx`** — Individual bill card (mirrors `AlertCard`/`ExpenseCard`)
- Displays biller name, amount due, due date, subject, relative timestamp
- Delete button

**7. `src/components/flows/bill-due-reminder/ActivatingScreen.tsx`** — Loading screen during activation

**8. `supabase/functions/bill-due-reminder/index.ts`** — Edge function (mirrors email-text-alert pattern)
- Actions: `activate`, `deactivate`, `manual-sync`
- `manual-sync`: Fetch Gmail with query `(bill OR payment OR invoice OR due OR statement OR utility OR autopay OR "amount due" OR "payment due" OR "balance due") newer_than:7d`
- Use `GMAIL_FETCH_EMAILS` with auth config `ac_IlbziSKZknmH`
- Deduplicate against `bill_due_reminder_processed` table
- For each new email: call LLM to extract `{ billerName, amountDue, dueDate }` as JSON
- Save to `bill_due_reminder_processed` table
- Save memory to LIAM with tag `BILL` (same `importPrivateKey`/`signRequest`/`saveMemoryToLiam` pattern)

### Files to Modify

**9. `src/data/threads.ts`** — Add thread entry
```
{
  id: "bill-due-reminder",
  title: "Bill Due Reminder",
  description: "Scan Gmail for bills and payment due dates, track them automatically",
  icon: Receipt,
  gradient: "orange",
  status: "active",
  type: "automation",
  category: "personal",
  integrations: ["gmail"],
  triggerType: "automatic",
  flowMode: "thread",
}
```

**10. `src/data/flowConfigs.ts`** — Add flow config with `isBillDueReminderFlow: true`

**11. `src/data/threadConfigs.ts`** — Add thread config with steps

**12. `src/types/flows.ts`** — Add `isBillDueReminderFlow?: boolean`

**13. `src/pages/Threads.tsx`** — Add `"bill-due-reminder"` to `flowEnabledThreads`

**14. `src/pages/FlowPage.tsx`** — Add conditional render for `config.isBillDueReminderFlow` → `<BillDueReminderFlow />`

### Database Migration

Create two tables:
- `bill_due_reminder_config` (id, user_id, is_active, bills_found, created_at, updated_at) with RLS
- `bill_due_reminder_processed` (id, user_id, email_message_id unique, biller_name, amount_due, due_date, subject, created_at) with RLS + delete policy

### Technical Notes
- Edge function uses `LOVABLE_API_KEY` for LLM extraction (already available as secret)
- LIAM keys fetched from `user_api_keys` table per user (same as email-receipt-sheet)
- Gmail query uses fixed bill-related keywords — no user configuration needed
- Intent guard pattern ensures seamless OAuth return to `/flow/bill-due-reminder`

