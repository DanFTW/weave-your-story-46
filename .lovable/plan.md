

## Add Expense History to Email Receipt Sheet

### Overview
Replace the static "Expenses tracked" count with a collapsible history section listing individual expense cards, matching the pattern from email-text-alert and weekly-event-finder threads.

### Database
The `email_receipt_sheet_processed` table already has `vendor`, `amount`, `date_str`, and `email_message_id` but lacks a DELETE RLS policy. A migration is needed:
```sql
CREATE POLICY "Users can delete their own processed receipts"
ON public.email_receipt_sheet_processed
FOR DELETE TO authenticated
USING (auth.uid() = user_id);
```

### Files to change

**1. `src/types/emailReceiptSheet.ts`**
- Add `ProcessedExpense` interface: `{ id, vendor, amount, dateStr, emailMessageId, createdAt }`

**2. `src/hooks/useEmailReceiptSheet.ts`**
- Add `expenses: ProcessedExpense[]` state
- Add `loadExpenses()` — select 50 most recent from `email_receipt_sheet_processed` ordered by `created_at desc`
- Add `deleteExpense(id)` — delete row, remove from local state, decrement `rows_posted` on config, toast
- Call `loadExpenses()` after `loadConfig()` completes and after `manualSync`
- Export `expenses` and `deleteExpense`

**3. New: `src/components/flows/email-receipt-sheet/ExpenseCard.tsx`**
- `forwardRef` component (for Radix CollapsibleContent compatibility)
- Props: `expense: ProcessedExpense`, `onDelete?: (id: string) => Promise<void>`
- Flat card (no per-card collapsible), shows:
  - Receipt icon + vendor name + relative timestamp
  - Amount (bold)
  - Date string
  - Delete button with loading state
- Styling: `bg-card rounded-2xl border border-border p-4 space-y-2`

**4. `src/components/flows/email-receipt-sheet/ActiveMonitoring.tsx`**
- Accept new props: `expenses: ProcessedExpense[]`, `onDeleteExpense: (id: string) => Promise<void>`
- Replace the static stats card with a `Collapsible` section (same pattern as email-text-alert):
  - Trigger: Receipt icon, "Expenses tracked", count, ChevronDown/Up
  - Content: map expenses to `ExpenseCard` components, or empty state message
- Add `useState(false)` for collapsible open state

**5. `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`**
- Destructure `expenses` and `deleteExpense` from hook
- Pass them to `ActiveMonitoring`

