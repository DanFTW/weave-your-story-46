

# Single-Line Title Truncation for Thread Cards

## Summary
Truncate thread card titles to a single line with ellipsis (...) instead of allowing them to wrap. This ensures consistent card heights without needing to adjust card dimensions or flex layouts.

---

## Problem

Currently, long titles like "HubSpot Contact Tracker" can wrap to 2 lines, pushing the description and footer down, causing overflow or inconsistent card heights.

**Current behavior:**
```text
┌─────────────────────────────────────┐
│ HubSpot Contact          [→]       │
│ Tracker                             │  ← Title wraps to 2 lines
│ Automatically save new CRM...       │
│                                     │
│ 🔶              [Auto] [Thread]     │  ← Footer gets pushed down
└─────────────────────────────────────┘
```

---

## Solution

Apply `truncate` class to the title `<h3>` element, which adds:
- `overflow: hidden`
- `text-overflow: ellipsis`
- `white-space: nowrap`

**After fix:**
```text
┌─────────────────────────────────────┐
│ HubSpot Contact Tracker...   [→]   │  ← Single line, truncated
│ Automatically save new CRM...       │
│                                     │
│ 🔶              [Auto] [Thread]     │  ← Footer stays in place
└─────────────────────────────────────┘
```

---

## File Changes

### `src/components/ThreadCard.tsx`

**Line 68** - Add `truncate` class to title:

```tsx
// Before
<h3 className="text-lg font-semibold text-white leading-tight">
  {thread.title}
</h3>

// After
<h3 className="text-lg font-semibold text-white leading-tight truncate">
  {thread.title}
</h3>
```

---

## Technical Details

| Property | Value | Effect |
|----------|-------|--------|
| `truncate` | Tailwind utility | Combines `overflow-hidden`, `text-overflow: ellipsis`, `white-space: nowrap` |
| Parent `min-w-0` | Already present | Allows flex child to shrink below content size (required for truncation to work) |

The parent `<div className="flex-1 min-w-0">` already has `min-w-0` which is required for text truncation to work properly in flexbox contexts.

---

## Visual Comparison

### Before
```text
Twitter Alpha          [→]
Tracker
Track posts from any...
```

### After
```text
Twitter Alpha Tracker...  [→]
Track posts from any...
```

All cards will now have consistent vertical rhythm with:
- 1 line for title (truncated if needed)
- Up to 2 lines for description (already has `line-clamp-2`)
- Fixed footer row with icons and badges

