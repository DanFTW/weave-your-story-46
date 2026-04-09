

## Wrap Events List in Collapsible Section

### Change
Replace the always-visible events list in `ActiveMonitoring.tsx` with a collapsible section using the existing `Collapsible` component (same pattern used by `FoundEventCard`). Collapsed by default, showing a summary header with the count. Expanding reveals the full list of individually-expandable `FoundEventCard` items.

### File: `src/components/flows/weekly-event-finder/ActiveMonitoring.tsx`

Replace lines 106-125 (the events list section) with a `Collapsible` wrapper:

- **Collapsed state (default):** A card-style trigger showing the Calendar icon, "Events found (N)" title, and a ChevronDown/ChevronUp indicator -- matching the existing card styling (`bg-card rounded-2xl border border-border`).
- **Expanded state:** Reveals the list of `FoundEventCard` components (or the empty-state message) below the trigger, inside `CollapsibleContent`.
- Add local `useState(false)` for the section's open state.
- Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible` and `ChevronDown`/`ChevronUp` from `lucide-react`.

No other files change. The individual event cards remain independently expandable inside the collapsible section.

