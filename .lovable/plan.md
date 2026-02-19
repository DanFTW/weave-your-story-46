
# Mine | Shared with Me Toggle — Memories Page

## What's Being Built

A segmented toggle positioned below the filter tag row that switches between two views:
- **Mine** — the user's own memories (current default behavior)
- **Shared with Me** — memories other users have explicitly shared with the signed-in user (resolved via `memory_share_recipients` where `recipient_email` matches the logged-in user's email)

The screenshot shows a pill-style toggle (rounded, inset shadow on the active segment) sitting directly below the horizontal icon filter row. Shared memories display a "Shared by [Name]" attribution on the card.

---

## Data Flow

### "Mine" tab
Exactly the current behavior — `listMemories()` from LIAM API + Twitter/Instagram local posts. No change.

### "Shared with Me" tab
1. Query `memory_share_recipients` where `recipient_email = user.email` OR `recipient_user_id = user.id`
2. Join `memory_shares` to get `memory_id`, `share_scope`, `custom_condition`, `thread_tag`, `owner_user_id`, `share_token`
3. For each share, call the `memory-share` edge function `resolve` action (already implemented) to get `owner_name`
4. Display shared memories with a "Shared by [Name]" attribution, a chain-link badge in the header, and the share scope info

The key insight: the LIAM API is auth-gated to the session owner — we **cannot** fetch another user's memory content directly. So for "Shared with Me" view, we display the share metadata (scope, condition, tag, sharer info) and a "View in app" deep link, exactly as the `/shared/:token` page already does. This is the correct architecture — content stays with its owner.

---

## Implementation Plan

### 1. New hook — `src/hooks/useSharedWithMe.ts`

A dedicated hook that:
- Gets the current user's email and ID from `useAuth`
- Queries Supabase directly:
  ```sql
  SELECT 
    msr.share_id, msr.recipient_email, msr.viewed_at,
    ms.memory_id, ms.share_scope, ms.custom_condition, 
    ms.thread_tag, ms.share_token, ms.owner_user_id, ms.created_at
  FROM memory_share_recipients msr
  JOIN memory_shares ms ON ms.id = msr.share_id
  WHERE msr.recipient_email = :userEmail
     OR msr.recipient_user_id = :userId
  ORDER BY ms.created_at DESC
  ```
- Fetches owner profiles for each unique `owner_user_id` from the `profiles` table
- Returns structured `SharedMemoryItem[]` with all metadata for display
- Exposes `isLoading`, `refetch`

### 2. New type — `SharedMemoryItem`

Added to `src/types/memory.ts`:
```typescript
export interface SharedMemoryItem {
  shareId: string;
  shareToken: string;
  memoryId: string;
  shareScope: 'single' | 'thread' | 'custom';
  customCondition: string | null;
  threadTag: string | null;
  ownerUserId: string;
  ownerName: string | null;
  sharedAt: string;
  viewedAt: string | null;
}
```

### 3. New component — `src/components/memories/SharedWithMeList.tsx`

Renders the "Shared with Me" tab content. Each item displays as a card with:
- Gradient header matching the share scope/tag (reuses `categoryConfig` from `MemoryCard`)
- A chain-link icon + "Shared" badge in the top-right of the header
- Content body: "Shared by [ownerName or 'Someone']" + scope description
- Tag badge: scope (`single memory`, `all from [tag]`, `custom: [condition]`)
- Tap → navigates to `/shared/[shareToken]` for full view
- Empty state if no shares received

### 4. Toggle component — `src/components/memories/MemoryViewToggle.tsx`

A minimal pill-style segmented control:
- Two segments: "Mine" | "Shared with Me"
- Active segment: `bg-background` with a subtle shadow (matches screenshot)
- Container: `bg-secondary rounded-full p-1`
- Animated with `framer-motion` `layoutId` for the sliding active indicator (consistent with existing filter bar pattern)
- Props: `value: 'mine' | 'shared'`, `onChange: (v) => void`

### 5. Update `src/components/memories/MemoryFilterBar.tsx`

Add `memoryView`, `onMemoryViewChange` props and render the `MemoryViewToggle` **below** the existing icon row:

```tsx
<div className="space-y-3">
  {/* existing icon row + filter button */}
  <div className="flex items-center gap-3"> ... </div>
  {/* new toggle row */}
  <MemoryViewToggle value={memoryView} onChange={onMemoryViewChange} />
</div>
```

### 6. Update `src/pages/Memories.tsx`

- Add `memoryView` state: `'mine' | 'shared'`, default `'mine'`
- Import and call `useSharedWithMe()` hook
- Pass `memoryView` and `onMemoryViewChange` to `MemoryFilterBar`
- Conditionally render:
  - `memoryView === 'mine'` → existing `<MemoryList>` with `allMemories`
  - `memoryView === 'shared'` → new `<SharedWithMeList>` with shared items
- When `memoryView === 'shared'`, the category filter pills still work but filter by `threadTag`

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/types/memory.ts` | Add `SharedMemoryItem` interface |
| `src/hooks/useSharedWithMe.ts` | New hook — queries `memory_share_recipients` joined with `memory_shares` + profiles |
| `src/components/memories/MemoryViewToggle.tsx` | New pill-style "Mine / Shared with Me" toggle |
| `src/components/memories/SharedWithMeList.tsx` | New list component rendering shared memory cards |
| `src/components/memories/MemoryFilterBar.tsx` | Add `memoryView` prop + render toggle below icon row |
| `src/pages/Memories.tsx` | Add `memoryView` state, wire hook, conditionally render |

No edge function changes, no migration needed — the existing `memory_share_recipients` table already has everything required.

---

## Key Technical Decisions

- **No new DB migration** — the existing schema already supports the "Shared with Me" query via `recipient_email` and `recipient_user_id` columns
- **RLS-safe query** — the `memory_share_recipients` table has RLS policies; the query uses the user's anon key so only their own rows are returned
- **Content stays with owner** — we never proxy another user's LIAM content; the shared view shows metadata + a tap-through to `/shared/:token` where the full token-based resolution happens
- **Toggle persists category filter** — switching between Mine/Shared does not reset the active category pill (e.g., if "Instagram" is active, Shared view filters by INSTAGRAM tag)
- **framer-motion layoutId** — the sliding toggle indicator uses `layoutId="memoryViewActive"` (distinct from `"activeFilter"` already in use)
- **`useSharedWithMe` is lazy** — only fetches when the user taps "Shared with Me" for the first time, to avoid unnecessary queries on every page load
