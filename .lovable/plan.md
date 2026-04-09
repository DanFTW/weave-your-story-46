

## Simplify Email Alert Cards

### What changes
The `AlertCard` component currently uses a `Collapsible` pattern where each card must be expanded to see details. We'll remove the per-card collapsible and render all content (sender, subject, summary, delete button) immediately visible. The outer "Alerts sent" collapsible in `ActiveMonitoring` stays as-is.

### File: `src/components/flows/email-text-alert/AlertCard.tsx`
- Remove `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` imports and usage
- Remove `useState` for `isOpen`
- Remove chevron icons
- Render a flat card with:
  - Mail icon + subject/sender as header row + relative timestamp
  - "From:" line showing sender email
  - Summary text
  - Delete button (keep existing `handleDelete` logic with loading state)
- Keep `forwardRef` wrapper
- Styling: `bg-card rounded-2xl border border-border p-4 space-y-2`

### No other files change
`ActiveMonitoring.tsx` already wraps the cards in the "Alerts sent" collapsible and passes `onDeleteAlert` — no changes needed there.

