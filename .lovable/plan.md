

## Fix Delete Button Not Rendering in FoundEventCard

### Root Cause
The console shows: "Function components cannot be given refs. Check the render method of `ActiveMonitoring` at FoundEventCard."

Radix's `CollapsibleContent` internally tries to compose refs onto its direct children. `FoundEventCard` is a plain function component without `forwardRef`, so the ref is silently dropped. In some React reconciliation paths this can interfere with the content rendering correctly after the Collapsible animation completes.

### Fix

**File: `src/components/flows/weekly-event-finder/FoundEventCard.tsx`**

Wrap the component with `React.forwardRef` so Radix can attach its ref. This resolves the warning and ensures the full expanded content (including the delete button) renders reliably.

- Import `forwardRef` from React
- Convert the component signature to use `forwardRef`, passing the ref to the outer `Collapsible` wrapper div
- Keep all existing logic and props intact

This is a minimal, single-file change. No other files need modification — the wiring from hook → flow → monitoring → card is already correct.

