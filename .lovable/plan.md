

## Plan: Replace List Picker with Board Overview + Sync

### Summary
After selecting a board, instead of picking a single "done" list, the user sees **all lists** from the board with expandable dropdowns showing cards per list. A "Sync Now" button fetches the latest data. The `select-done-list` phase is replaced with a `board-overview` phase.

### Files to modify (constraint: only these files)

**1. `src/types/trelloAutomation.ts`**
- Add `'board-overview'` to `TrelloAutomationPhase`
- Add `TrelloListWithCards` type: extends `TrelloList` with a `cards: TrelloCard[]` field

**2. `src/components/flows/trello-automation/ListPicker.tsx`** — full rewrite → `BoardOverview`
- Rename/rewrite as the board overview component
- Props: `lists: TrelloListWithCards[]`, `isLoading`, `isSyncing`, `boardName`, `onSync`
- Renders all lists as accordion items using `Accordion` from `@/components/ui/accordion`
- Each accordion trigger shows list name + `Badge` with card count
- Each accordion content shows card names (simple list with card title, optional labels/due)
- Bottom: full-width "Sync Now" `Button` (h-14, rounded-2xl per style standards) that calls `onSync`
- Loading skeleton while initial load; spinner on Sync button while syncing

**3. `supabase/functions/trello-automation-triggers/index.ts`**
- Add new action `get-cards` that calls `TRELLO_GET_BOARDS_CARDS_BY_ID_BOARD` with the board ID
- Returns `{ cards: TrelloCard[] }` with same `details` extraction pattern
- Add new action `get-board-data` (convenience) that fetches lists AND cards in parallel, then groups cards by `idList` and returns `{ lists: TrelloListWithCards[] }`

**4. `src/hooks/useTrelloAutomation.ts`**
- Add `listsWithCards` state (`TrelloListWithCards[]`)
- Add `isSyncing` state for the sync button
- Add `fetchBoardData(boardId)` — calls `get-board-data` action, sets `listsWithCards`
- Add `syncBoard()` — re-fetches board data for current board, updates state
- Update `selectBoard` to transition to `'board-overview'` instead of `'select-done-list'`, and call `fetchBoardData`
- Remove `selectDoneList` from the flow (keep function for backward compat but it's unused)
- Update `loadConfig`: if board is selected but not active, go to `'board-overview'` instead of `'select-done-list'`
- Export new state/functions

**5. `src/components/flows/trello-automation/TrelloAutomationFlow.tsx`**
- Import the rewritten ListPicker/BoardOverview
- Replace the `select-done-list` phase rendering with `board-overview` phase rendering the new component
- Update header subtitle for `board-overview`: "Board overview"
- Update `handleBack`: `board-overview` goes back to `select-board`
- Remove `configure` phase from the main flow (or keep it accessible from board overview if needed — but per the request, the board overview IS the new post-board-select screen)

### Edge function: `get-board-data` action detail

```text
1. Fetch lists via TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD
2. Fetch cards via TRELLO_GET_BOARDS_CARDS_BY_ID_BOARD  
3. Group cards by idList
4. Return { lists: [{ id, name, closed, cards: [...] }] }
```

### UI structure (BoardOverview)

```text
┌─────────────────────────────┐
│ Board: "My Project"         │
│                             │
│ ▸ To Do                [3]  │
│ ▾ In Progress          [2]  │
│   ├ Card: Fix login bug     │
│   └ Card: Update docs       │
│ ▸ Done                 [5]  │
│ ▸ Backlog              [1]  │
│                             │
│ ┌─────────────────────────┐ │
│ │     🔄  Sync Now        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### What stays unchanged
- `BoardPicker.tsx` — untouched
- `ActiveMonitoring.tsx` — untouched  
- `AutomationConfig.tsx` — untouched (though no longer reached in the default flow)
- `ActivatingScreen.tsx` — untouched

