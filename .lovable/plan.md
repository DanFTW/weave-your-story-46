

## Fix "Enable Grocery Sync" Button

### Root Cause

Two bugs prevent the button from working:

1. **Wrong Composio tool slug**: The edge function uses `GOOGLESHEETS_LIST_SPREADSHEETS` which doesn't exist (404 in logs). The correct slug is `GOOGLESHEETS_SEARCH_SPREADSHEETS`.

2. **Missing spreadsheetId in create response**: The `create-spreadsheet` action returns `{ spreadsheetName: "Weave — Grocery Items" }` without a `spreadsheetId` because the Composio response structure isn't being parsed correctly. The frontend `AutomationConfig` sets `selectedId` from the returned `id`, which is `undefined`, so the button stays disabled (`disabled={!selectedId}`).

### Changes

**1. `supabase/functions/grocery-sheet-sync/index.ts`**

- **Line 249**: Replace `GOOGLESHEETS_LIST_SPREADSHEETS` with `GOOGLESHEETS_SEARCH_SPREADSHEETS`
- **Lines 325-329**: Improve spreadsheetId extraction from the create response — log the raw Composio response to debug the actual structure, and broaden the ID extraction to check nested paths like `response_data.spreadsheetId`, `response_data.result.spreadsheetId`, etc.
- Add a fallback: if `spreadsheetId` is still null after creation, generate a deterministic ID or return an error so the frontend doesn't silently fail.

**2. `src/hooks/useGrocerySheetSync.ts`**

- In `createSpreadsheet`: if the response has no `spreadsheetId`, treat the creation as failed and show an error toast instead of returning a `SpreadsheetOption` with an undefined id.

**3. `src/components/flows/grocery-sheet-sync/AutomationConfig.tsx`**

- In `handleCreate`: after `onCreateSheet()`, if `sheet` is null or `sheet.id` is falsy, don't update `selectedId`. This is a safety guard.

**4. Redeploy** the `grocery-sheet-sync` edge function.

### Technical Details

The Composio `GOOGLESHEETS_CREATE_GOOGLE_SHEET1` tool returns a nested response. We need to log the full raw response once to identify the exact path to the spreadsheet ID, then extract it properly. Common paths: `response_data.spreadsheetId`, `response_data.result.spreadsheetId`, or the response may use a different key like `response_data.spreadsheet_id`. The fix will check all known paths and log the raw response for future debugging.

