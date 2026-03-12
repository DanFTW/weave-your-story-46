

## Problem

When the user navigates to `/integration/slack` (either on initial load or after returning from OAuth), the `checkStatus()` function runs asynchronously but there is **no loading state** during that check. The page renders the **disconnected UI** (showing the "Connect" button) until `checkStatus()` resolves and updates `isConnected`. This causes a jarring flash of disconnected state before the connected account card appears.

Additionally, `useComposio` has no concept of an "initializing" or "checking" state -- `connecting` is only set to `true` during the `connect()` flow, not during `checkStatus()`.

## Fix (single file: `src/hooks/useComposio.ts`)

1. **Add a `checking` state** (or rename/extend the existing `connecting` state):
   - Add `const [checking, setChecking] = useState(true)` -- defaults to `true` so the page shows a loading state on mount.
   - In `checkStatus()`, wrap the logic with `setChecking(true)` / `setChecking(false)`.
   - Expose `checking` in the return value.

2. **Update `IntegrationDetail.tsx`** to use the new `checking` state:
   - Destructure `checking` from the hook (or unify it with `connecting`).
   - Use `const isLoading = connecting || checking` so the spinner shows during both initial status check and active connection flow.

**Simpler alternative** (fewer changes): Just set `connecting = true` at the start of `checkStatus()` and `false` at the end. However, this conflates two different states. The cleaner approach is a separate `checking` boolean.

### Implementation detail

In `useComposio.ts`:
- Initialize state: `const [checking, setChecking] = useState(true);`
- In `checkStatus`: add `setChecking(true)` at the start and `setChecking(false)` in the finally block.
- Return `checking` alongside existing values.

In `IntegrationDetail.tsx`:
- Destructure `checking` (handle the fact that `iosContacts` hook doesn't have it -- default to `false`).
- Change `const isLoading = connecting || checking;` (line ~149).

### Files changed
- `src/hooks/useComposio.ts` -- add `checking` state to hook
- `src/pages/IntegrationDetail.tsx` -- consume `checking` in loading logic

