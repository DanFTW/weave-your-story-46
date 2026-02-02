
# Thread Card Consistent Height on Home Page

## Summary
Ensure all thread cards in the Home page carousel have the same fixed height for a consistent, polished carousel experience.

---

## Problem Analysis

**Current Behavior:**
- The `ThreadCard` component uses `min-h-[140px]` which only sets a minimum height
- Cards with longer descriptions expand taller than cards with shorter descriptions
- This creates an uneven visual appearance in the carousel

**On `/threads` page:**
- Cards stacked vertically look fine with variable heights
- Natural content flow where each card size matches its content

**On Home page (`/`):**
- Horizontal carousel where inconsistent heights look jarring
- Cards should align perfectly for smooth swiping experience

---

## Solution

Add an optional `fixedHeight` prop to `ThreadCard` that enforces a consistent height when used in carousel contexts like the Home page.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ThreadCard.tsx` | Add optional `fixedHeight` prop |
| `src/pages/Home.tsx` | Pass `fixedHeight` prop to ThreadCard |

---

## Code Changes

### 1. ThreadCard.tsx - Add `fixedHeight` prop

```tsx
interface ThreadCardProps {
  thread: Thread;
  onClick?: () => void;
  className?: string;
  fixedHeight?: boolean;  // NEW: When true, use fixed height instead of min-height
}

export function ThreadCard({ thread, onClick, className, fixedHeight = false }: ThreadCardProps) {
  // ... existing code ...

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full relative overflow-hidden rounded-2xl p-5 text-left",
        fixedHeight ? "h-[140px]" : "min-h-[140px]",  // Fixed vs minimum height
        "flex flex-col",
        "shadow-lg shadow-black/5 active:scale-[0.98] transition-transform",
        !dynamicGradient && gradientClasses[thread.gradient],
        className
      )}
      // ... rest unchanged
    >
```

### 2. Home.tsx - Use fixed height for carousel cards

```tsx
<ThreadCard
  thread={thread}
  onClick={() => navigate(`/thread/${thread.id}`)}
  fixedHeight  // Ensures consistent height in carousel
/>
```

---

## Visual Comparison

### Before (inconsistent heights)
```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Short title     │  │ Long title      │  │ Medium title    │
│ Brief desc      │  │ Very long desc  │  │ Two line        │
│                 │  │ that spans      │  │ description     │
│ [Auto] [Thread] │  │ multiple lines  │  │                 │
└─────────────────┘  │ with extra text │  │ [Auto] [Flow]   │
                     │ [Manual] [Dump] │  └─────────────────┘
                     └─────────────────┘
```

### After (consistent fixed heights)
```text
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Short title     │  │ Long title      │  │ Medium title    │
│ Brief desc      │  │ Very long de... │  │ Two line        │
│                 │  │                 │  │ description     │
│ [Auto] [Thread] │  │ [Manual] [Dump] │  │ [Auto] [Flow]   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Technical Notes

- Default behavior (`fixedHeight = false`) maintains backward compatibility
- The `/threads` page continues to use variable heights for natural content flow
- Description truncation via `line-clamp-2` already prevents overflow
- Uses Tailwind's `h-[140px]` for fixed height vs `min-h-[140px]` for minimum
