

## Batch Memory Toast Notifications

### Problem
`createMemory()` in `useLiamMemory.ts` fires a toast on every single call — success or error. When batch-saving 14 memories, users see 14 separate notifications.

### Solution
Add a `silent` option to `createMemory` that suppresses toasts. All batch callers already have their own summary toast after the loop, so they just need to pass `{ silent: true }`.

### Changes

**`src/hooks/useLiamMemory.ts`**
- Change `createMemory` signature from `(content: string, tag?: string)` to `(content: string, tag?: string, options?: { silent?: boolean })`.
- Wrap all 5 toast calls inside `createMemory` with `if (!options?.silent)` guards.
- No changes to the public return type shape — just an optional third parameter.

**`src/pages/FlowPage.tsx`** — 3 batch call sites:
- Line 410 (LLM import loop): pass `{ silent: true }` → existing summary toast at line 417 handles the notification.
- Line 586 (standard flow confirm loop): pass `{ silent: true }` → existing summary toast at line 593 handles it.
- Line 162 (single receipt save): leave as-is (not a batch).

**`src/hooks/useEmailDump.ts`** — 1 batch call site:
- Line 190: pass `{ silent: true }`. Check if there's already a summary toast after the loop; if not, add one.

**No other files changed.** `ProfileEditDrawer` and `Home.tsx` are single-call sites — left as-is.

### Files modified
1. `src/hooks/useLiamMemory.ts` — add `silent` option
2. `src/pages/FlowPage.tsx` — pass `{ silent: true }` in batch loops
3. `src/hooks/useEmailDump.ts` — pass `{ silent: true }` in batch loop

