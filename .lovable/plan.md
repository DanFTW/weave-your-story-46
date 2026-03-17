

## Problem

The tag row on each memory preview card uses `flex items-center` without wrapping. On narrow screens, the category tag (e.g. "Hobbies & Interests"), type badge (e.g. "INTERESTS"), and "Swipe to delete" text all compete for horizontal space, causing misalignment and overflow instead of wrapping cleanly.

## Plan — 1 file: `src/components/flows/MemoryPreviewCard.tsx`

### Fix tag layout (lines 117-142)

Replace the single `flex items-center gap-2` row with `flex flex-wrap items-center gap-2`. Move "Swipe to delete" to not use `ml-auto` so it wraps naturally instead of forcing everything onto one line.

**Before:**
```html
<div className="flex items-center gap-2 mt-3">
  <span>...</span>  <!-- category tag -->
  <button>...</button>  <!-- type badge -->
  <span className="... ml-auto">Swipe to delete</span>
</div>
```

**After:**
```html
<div className="flex flex-wrap items-center gap-2 mt-3">
  <span>...</span>  <!-- category tag -->
  <button>...</button>  <!-- type badge -->
  <span className="text-xs text-muted-foreground">Swipe to delete</span>
</div>
```

Key changes:
- Add `flex-wrap` so tags wrap to next line on narrow screens
- Remove `ml-auto` from "Swipe to delete" so it flows naturally with the wrapped tags instead of pushing content apart

