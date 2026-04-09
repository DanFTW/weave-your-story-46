

## Fix ExpenseCard Fallbacks and Harden Email Body Extraction

### Problem
1. `ExpenseCard` conditionally renders amount and date — when they're null/empty, those fields are hidden entirely, leaving a bare "Unknown vendor" card with no useful info.
2. The edge function's body extraction chain at line 605 treats `e.snippet` as a string, but Composio sometimes returns it as an object (`{ subject, body }`). When that happens, `e.snippet` is `[object Object]` and the LLM gets garbage instead of real email content.

### Fix 1: `src/components/flows/email-receipt-sheet/ExpenseCard.tsx`
- Lines 57-64: Remove the conditional `{expense.amount && ...}` / `{expense.dateStr && ...}` wrappers.
- Always render both fields with fallbacks: `expense.amount || "No amount"` and `expense.dateStr || "No date"`.
- Style the fallback text with `text-muted-foreground` to distinguish it from real data.

### Fix 2: `supabase/functions/email-receipt-sheet/index.ts`
- Lines 601-610: Harden the body and subject extraction in the candidates mapping:
  - Handle `e.snippet` as object: if it has `.body`, use that; if it has `.subject`, merge into subject.
  - Check `e.Subject` as a subject fallback (Composio casing inconsistency).
  - Add `e.From ?? e.from ?? e.sender` extraction so it's available for future use.
  - Log raw body length **before** the `emailText` composition (line 625 already logs after — add a log of the raw `body` field length per candidate to catch empty extractions early).

### Files
- `src/components/flows/email-receipt-sheet/ExpenseCard.tsx` — always-visible fallbacks
- `supabase/functions/email-receipt-sheet/index.ts` — robust body/subject extraction + logging

