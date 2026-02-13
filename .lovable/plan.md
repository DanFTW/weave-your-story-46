

# Auto-Search as You Type for Document Search

## Problem
Currently the user must type a query and explicitly press the "Search" button (or Enter) to see results. This adds unnecessary friction -- results should appear live as the user types.

## Solution
Add debounced auto-search to `DocumentSearch.tsx`. As the user types, after a short delay (300ms), the search fires automatically. The Search button is kept as a fallback but becomes secondary.

## Changes

### 1. `src/components/flows/googledrive-automation/DocumentSearch.tsx`

- Import `useEffect` and `useRef` from React
- Add a debounce mechanism using `useRef` for a timeout ID
- In the `onChange` handler, after updating `query`, set a 300ms debounce timer that calls `onSearch(trimmedQuery)` when the user pauses typing
- Clear the timer on each keystroke (standard debounce pattern)
- Clear results and reset `hasSearched` when input is emptied
- Clean up the timer on unmount via `useEffect` return
- Keep the Search button functional as an immediate trigger (bypasses debounce)
- Set `hasSearched = true` when auto-search fires so the empty-state message shows correctly

No other files are modified. The `onSearch` prop contract and edge function remain identical -- only the trigger timing changes from "on click" to "on type (debounced)".

## Technical Details

```text
User types "tes" -> 300ms pause -> onSearch("tes") fires automatically
User types "test" (continued typing) -> previous timer cleared, new 300ms timer
User clears input -> results cleared, hasSearched reset
User clicks Search -> immediate search (no debounce)
```

The 300ms debounce strikes the right balance: fast enough to feel instant, slow enough to avoid excessive API calls during rapid typing.

