
# Fix: Edge function returns generic 500 for expired Google Sheets connection

## Root Cause Analysis

The edge function is **not crashing** — it correctly catches the 410 "ConnectedAccountExpired" response from Composio. However, it swallows the specific error and returns a generic `{ error: "Failed to create spreadsheet" }` with status 500. The client-side error reporter shows `lineno 0, colno 0, stack not_applicable` because all edge function 500s are reported this way (no JS stack trace exists — the error is server-side).

The **real problem**: The user's Google Sheets OAuth token has expired. The edge function detects this but doesn't communicate it to the frontend, so the user sees "Failed to create spreadsheet" with no way to fix it.

## Fix (3 files)

### 1. Edge function: Detect expired connections and return `needsReconnect`
**File**: `supabase/functions/email-receipt-sheet/index.ts`

In the `list-spreadsheets` and `create-spreadsheet` action handlers, check for 410 status or "expired" in the response body. When detected, return `{ error: "Google Sheets connection expired. Please reconnect.", needsReconnect: true }` with status 401 instead of a generic 500.

Also apply to `manual-sync` for consistency.

### 2. Frontend hook: Handle `needsReconnect` flag
**File**: `src/hooks/useEmailReceiptSheet.ts`

In `listSpreadsheets`, `createSpreadsheet`, and `manualSync` callbacks, check `data?.needsReconnect`. When true, set phase to `"needs-reconnect"` and show a descriptive toast.

### 3. Types: Add `"needs-reconnect"` phase
**File**: `src/types/emailReceiptSheet.ts`

Add `"needs-reconnect"` to `EmailReceiptSheetPhase`.

### 4. Flow component: Render reconnect UI
**File**: `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`

When `phase === "needs-reconnect"`, render a screen with a message explaining the connection expired and a button that navigates to `/integration/googlesheets` (with a return path in sessionStorage).

## No database changes needed.
