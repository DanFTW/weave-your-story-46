

## Grocery Memory to Google Sheet — Thread Implementation

### Overview
A new Thread that auto-posts grocery-related memories to a user-selected Google Sheet. Mirrors the restaurant-bookmark-sync architecture: auth gate → configure (sheet picker + toggle) → active monitoring with manual sync.

### Database Tables (2 new tables via migration)

**`grocery_sheet_config`**
- `id` uuid PK, `user_id` uuid NOT NULL, `is_active` boolean DEFAULT false
- `spreadsheet_id` text, `spreadsheet_name` text, `sheet_name` text
- `items_posted` integer DEFAULT 0, `created_at` / `updated_at` timestamptz
- RLS: user can SELECT/INSERT/UPDATE own rows only

**`grocery_sheet_processed_memories`**
- `id` uuid PK, `user_id` uuid NOT NULL, `memory_id` text NOT NULL
- `created_at` timestamptz DEFAULT now()
- UNIQUE(user_id, memory_id) — dedup index
- RLS: user can SELECT/INSERT own rows only

### Edge Function: `grocery-sheet-sync`

Single edge function with these actions:

- **`activate`** — sets `is_active = true`
- **`deactivate`** — sets `is_active = false`
- **`update-config`** — saves selected spreadsheet_id / spreadsheet_name / sheet_name
- **`list-spreadsheets`** — calls Composio `GOOGLESHEETS_LIST_SPREADSHEETS` to return user's sheets
- **`create-spreadsheet`** — calls Composio `GOOGLESHEETS_CREATE_GOOGLE_SHEET1` to create a new sheet titled "Weave — Grocery Items"
- **`process-new-memory`** — AI parses memory for grocery items; if found, appends rows via Composio `GOOGLESHEETS_BATCH_UPDATE` (or `SHEET_FROM_JSON`)
- **`manual-sync`** — fetches LIAM memories, filters unprocessed, parses each for groceries, posts found items to the sheet

AI parsing prompt: extract grocery/food items with quantity, item name, and optional notes. Uses `LOVABLE_API_KEY` + Gemini tool-calling (same pattern as restaurant sync).

### Types: `src/types/grocerySheetSync.ts`

```
GrocerySheetSyncPhase = "auth-check" | "configure" | "activating" | "active"
GrocerySheetSyncConfig { id, userId, isActive, spreadsheetId, spreadsheetName, sheetName, itemsPosted, ... }
GrocerySheetSyncStats { itemsPosted, isActive }
SpreadsheetOption { id, name }
```

### Hook: `src/hooks/useGrocerySheetSync.ts`

Mirrors `useRestaurantBookmarkSync`: loadConfig, activate, deactivate, updateConfig, listSpreadsheets, createSpreadsheet, manualSync. State: phase, config, stats, spreadsheets list, loading flags.

### UI Components: `src/components/flows/grocery-sheet-sync/`

| File | Purpose |
|---|---|
| `GrocerySheetSyncFlow.tsx` | Main flow: auth gate via `useComposio('GOOGLESHEETS')`, phase routing. Mirrors `RestaurantBookmarkSyncFlow`. |
| `AutomationConfig.tsx` | Sheet picker dropdown + "Create new" button, auto-post toggle, "Activate" button |
| `ActiveMonitoring.tsx` | Auto-sync toggle, items posted stat, Sync Now button, Pause hint |
| `ActivatingScreen.tsx` | Loading screen during activation |
| `index.ts` | Re-export |

### Registration (7 existing files)

1. **`src/data/threads.ts`** — add `grocery-sheet-sync` entry (icon: `ShoppingCart`, gradient: `"teal"`, integrations: `["googlesheets"]`, flowMode: `"thread"`, triggerType: `"automatic"`)
2. **`src/data/threadConfigs.ts`** — add config with 3 steps: Connect Google Sheets → Configure Sheet → Always-On Monitoring
3. **`src/data/flowConfigs.ts`** — add entry with `isGrocerySheetSyncFlow: true`
4. **`src/types/flows.ts`** — add `isGrocerySheetSyncFlow?: boolean` to `FlowConfig`
5. **`src/pages/FlowPage.tsx`** — import `GrocerySheetSyncFlow`, add render branch
6. **`src/pages/Threads.tsx`** — add `'grocery-sheet-sync'` to `flowEnabledThreads`
7. **`src/pages/ThreadOverview.tsx`** — add `'grocery-sheet-sync'` to `flowEnabledThreads`

### Fire-and-forget trigger: `src/utils/triggerGrocerySheetSync.ts`

Same pattern as `triggerCalendarSync` / `triggerRestaurantBookmarkSync`:
- Check `grocery_sheet_config.is_active`
- If active, invoke `grocery-sheet-sync` edge function with `process-new-memory` action
- Wire into `useLiamMemory.ts` `createMemory` alongside existing triggers

### Composio Tools Used
- `GOOGLESHEETS_LIST_SPREADSHEETS` — list user's sheets for picker
- `GOOGLESHEETS_CREATE_GOOGLE_SHEET1` — create new sheet
- `GOOGLESHEETS_BATCH_UPDATE` — append grocery rows to selected sheet

All calls go through the user's existing Google Sheets Composio connection (auth config `ac_P0DYB0XdGLn3`, already registered).

