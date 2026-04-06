# Email Receipt to Spreadsheet Thread

## Overview

A new automatic thread that monitors Gmail for purchase/receipt emails, uses an LLM to extract date/vendor/amount, and appends rows to a user-selected Google Sheet. Modeled directly on the grocery-sheet-sync thread (two-integration flow with config table + edge function).

## Architecture

text

```text
User flow:
/threads → card click → /thread/email-receipt-sheet (overview) → /flow/email-receipt-sheet

Flow phases:
1. Auth check → redirect to /integration/gmail if not connected
2. Auth check → redirect to /integration/googlesheets if not connected  
3. Configure → select/create spreadsheet
4. Activating → spinner
5. Active → toggle on/off, stats, manual sync
```

## Files to Create

### 1. Database: `email_receipt_sheet_config` table + `email_receipt_sheet_processed` table

- `email_receipt_sheet_config`: `id`, `user_id`, `is_active`, `spreadsheet_id`, `spreadsheet_name`, `sheet_name`, `rows_posted` (default 0), `created_at`, `updated_at`
- `email_receipt_sheet_processed`: `id`, `user_id`, `email_message_id` (unique per user for dedup), `vendor`, `amount`, `date_str`, `created_at`
- RLS: users can only read/write their own rows

### 2. Types: `src/types/emailReceiptSheet.ts`

- Mirror `grocerySheetSync.ts`: phases, config interface, stats interface, reuse `SpreadsheetOption`

### 3. Hook: `src/hooks/useEmailReceiptSheet.ts`

- Mirror `useGrocerySheetSync.ts` exactly: loadConfig, listSpreadsheets, createSpreadsheet, updateConfig, activate, deactivate, manualSync
- All actions invoke `email-receipt-sheet` edge function

### 4. Edge Function: `supabase/functions/email-receipt-sheet/index.ts`

- Actions: `activate`, `deactivate`, `update-config`, `list-spreadsheets`, `create-spreadsheet`, `manual-sync`
- `manual-sync` action:
  1. Get Gmail connection from `user_integrations` (integration_id = "gmail")
  2. Get Google Sheets connection from `user_integrations` (integration_id = "googlesheets")
  3. Fetch emails via `GMAIL_FETCH_EMAILS` with receipt/purchase query keywords
  4. Deduplicate against `email_receipt_sheet_processed` by `email_message_id`
  5. For each new email, call LLM (Lovable AI gateway) to extract `{date, vendor, amount}` from email body
  6. Append row to sheet via `GOOGLESHEETS_BATCH_UPDATE` (omit `first_cell_location` for append)
  7. Save to LIAM as memory with tag `EXPENSE`
  8. Record in `email_receipt_sheet_processed` for dedup
- `list-spreadsheets` and `create-spreadsheet`: reuse grocery-sheet-sync's Composio patterns exactly
- Gmail auth config: `ac_IlbziSKZknmH` (user-specified, different from the standard Gmail config)
- Google Sheets auth config: `ac_P0DYB0XdGLn3`

### 5. Flow Components: `src/components/flows/email-receipt-sheet/`

- `EmailReceiptSheetFlow.tsx`: Main flow component. Two-step auth gate (Gmail then Google Sheets), then renders config or active monitoring. Mirror `GrocerySheetSyncFlow` structure.
- `AutomationConfig.tsx`: Spreadsheet picker + "Enable Expense Tracking" button. Reuse grocery pattern.
- `ActiveMonitoring.tsx`: Toggle, target sheet, rows posted stat, sync now button. Reuse grocery pattern with Receipt icon.
- `ActivatingScreen.tsx`: Loading spinner. Mirror grocery pattern.
- `index.ts`: Barrel export.

### 6. Thread Registration

- `**src/data/threads.ts**`: Add thread entry `id: "email-receipt-sheet"` in `mainThreads` with `icon: Receipt`, `gradient: "teal"`, `integrations: ["gmail", "googlesheets"]`, `triggerType: "automatic"`, `flowMode: "thread"`
- `**src/data/threadConfigs.ts**`: Add config with 3 steps: Connect Gmail, Connect Google Sheets + select sheet, Expense Tracking toggle
- `**src/data/flowConfigs.ts**`: Add flow config with `isEmailReceiptSheetFlow: true`
- `**src/types/flows.ts**`: Add `isEmailReceiptSheetFlow?: boolean`

### 7. Routing Wiring

- `**src/pages/Threads.tsx**`: Add `"email-receipt-sheet"` to `flowEnabledThreads`
- `**src/pages/FlowPage.tsx**`: Import `EmailReceiptSheetFlow`, add render block for `isEmailReceiptSheetFlow`

### 8. Composio Config

- `**supabase/functions/composio-connect/index.ts**`: Ensure `googlesheets: "ac_P0DYB0XdGLn3"` is present in `AUTH_CONFIGS` and `"googlesheets"` is in `VALID_TOOLKITS`. Gmail (`ac_IlbziSKZknmH`) should already be registered.

## Key Technical Details

- Gmail connection uses auth config `ac_IlbziSKZknmH` (separate from the standard `ac_JO3RFglIYYKs`)
- Google Sheets connection uses auth config `ac_P0DYB0XdGLn3` and existing `googlesheets` integration (same as grocery-sheet-sync)
- LLM extraction prompt returns JSON `{date, vendor, amount}` via Lovable AI gateway
- Deduplication via `email_message_id` unique constraint prevents duplicate rows on re-sync
- LIAM memory write uses the same `importPrivateKey` / `signRequest` / `saveMemoryToLiam` pattern from `gmail-purchase-tracker`
- Sheet headers row: `Date | Vendor | Amount` (created on spreadsheet creation)
- `GOOGLESHEETS_BATCH_UPDATE` with `sheet_name: "Sheet1"` and no `first_cell_location` for append behavior