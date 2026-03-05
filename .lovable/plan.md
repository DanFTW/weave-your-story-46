

## Root Cause Analysis

The edge function logs show "Appended 1 items to sheet" (no errors), and the DB has a valid `spreadsheet_id`. The Composio API call returns 200 (otherwise an error would be logged). **But no data appears in the actual Google Sheet.**

The problem is in `appendToSheet()` — it sends **wrong parameter names** to the Composio `GOOGLESHEETS_BATCH_UPDATE` tool.

Current code (line 157-163):
```typescript
arguments: {
  spreadsheet_id: spreadsheetId,
  range: "Sheet1!A:D",          // WRONG — Composio doesn't use "range"
  values,
  value_input_option: "USER_ENTERED",  // WRONG — not a Composio param
}
```

Composio's `GOOGLESHEETS_BATCH_UPDATE` expects:
```typescript
arguments: {
  spreadsheet_id: spreadsheetId,
  sheet_name: "Sheet1",         // sheet name as separate param
  values,                       // list of lists
  // first_cell_location omitted = append mode
}
```

Because `range` and `value_input_option` are unrecognized, Composio silently accepts the request but doesn't actually write anything. The function sees a 200 response and logs success.

### Fix

**File: `supabase/functions/grocery-sheet-sync/index.ts`** — Update `appendToSheet()` (lines 157-163):

Replace `range: "Sheet1!A:D"` and `value_input_option: "USER_ENTERED"` with `sheet_name: "Sheet1"` (no `first_cell_location` so it appends).

Then redeploy the edge function.

