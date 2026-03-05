
Investigation summary (no code changes made):

1) What I checked
- Frontend flow state in:
  - `src/components/flows/grocery-sheet-sync/AutomationConfig.tsx`
  - `src/hooks/useGrocerySheetSync.ts`
- Edge function parsing in:
  - `supabase/functions/grocery-sheet-sync/index.ts`
- Live data/network:
  - `grocery_sheet_config` row for your user
  - client request to `action: "list-spreadsheets"` (returns `{"spreadsheets":[]}`)

2) Root cause chain
- The “Enable Grocery Sync” button is disabled by `disabled={isActivating || !selectedId}`.
- `selectedId` comes from `config.spreadsheetId` or a successful select/create action.
- Your DB row currently has:
  - `spreadsheet_name = "Weave — Grocery Items"`
  - `spreadsheet_id = null`
  So UI shows a name but internally no valid selected sheet ID exists.
- Why ID is missing:
  - `list-spreadsheets` parser is likely reading the Composio response at the wrong nesting level, so it returns an empty list (`[]`) even when sheets may exist.
  - `create-spreadsheet` block still has a parsing bug (`spreadsheetName` references `responseData`, which is undefined in that scope). This can break create-response handling and prevent reliably storing/returning `spreadsheetId`.

3) Initial solution (targeted, minimal)
- Edge function (`grocery-sheet-sync`) fixes:
  - Normalize Composio payload extraction using a single robust resolver that checks:
    - `data?.data?.response_data`
    - `data?.response_data`
    - `data?.data`
    - `data`
  - For list action, parse arrays from common keys (`files`, `items`, `spreadsheets`, direct array) after normalization.
  - For create action, remove undefined `responseData` reference and derive:
    - `spreadsheetId` from multiple known keys (`spreadsheet_id`, `spreadsheetId`, `id`, nested `result` paths).
    - `spreadsheetName` from title/name keys on the same normalized object.
  - If create succeeds but ID cannot be parsed, return structured debug info (safe keys only) so failures are diagnosable.
- Frontend safety/UX consistency:
  - If config has `spreadsheet_name` but no `spreadsheet_id`, treat as “not selected” in display text (avoid misleading state).
  - Keep button disabled until a real ID exists (current behavior is correct).

4) Validation checklist after implementing
- Open `/flow/grocery-sheet-sync`.
- Confirm `list-spreadsheets` returns non-empty (or expected) options.
- Create new spreadsheet once; verify function returns `spreadsheetId`.
- Confirm local selection is set and “Enable Grocery Sync” becomes clickable.
- Click “Enable Grocery Sync” and verify `grocery_sheet_config.is_active = true` with the chosen `spreadsheet_id`.
- End-to-end test: create a grocery memory and verify row append to the selected Google Sheet.
