

# Fix: Shared Memory Link Flow

## Problems Identified

### 1. Missing redirect parameter after login
In `SharedMemory.tsx` (line 211), when an unauthenticated user clicks "Sign in to view," they navigate to `/login` with **no redirect parameter**. After signing in, the Login page defaults to redirecting to `/` (home). The user never returns to the shared memory page or the memories page, so the shared memory effectively "disappears."

### 2. Race condition: parallel resolve + fetch
In `SharedMemory.tsx` (lines 102-105), the authenticated flow calls `resolveShareToken` and `fetchSharedContent` in parallel via `Promise.all`. However, `fetchSharedContent` (the `fetch-shared-memory` action) checks if the caller is a registered recipient (line 443-455 in the edge function). The recipient row is only created by `resolveShareToken`. Running them in parallel means `fetchSharedContent` can execute before the recipient is registered, returning a **403 "You don't have access"** error.

### 3. Redundant pendingShareToken path
The `pendingShareToken` localStorage mechanism in `Memories.tsx` is a fallback for the redirect, but since we're fixing the redirect to go back to `/s/<token>`, the primary flow no longer depends on it. It remains as a safety net but the main path will work correctly now.

---

## Proposed Changes

### File 1: `src/pages/SharedMemory.tsx`

**Fix A -- Add redirect param to login navigation (line 211):**
Change the "Sign in to view" button from `navigate("/login")` to `navigate("/login?redirect=/s/" + token)`. After auth, the Login page will redirect back to the share link, where `SharedMemory` will now detect the session and show the full memory.

**Fix B -- Sequentialize resolve before fetch (lines 102-105):**
Change from `Promise.all([resolveShareToken, fetchSharedContent])` to sequential calls: first resolve (which registers the user as recipient), then fetch (which requires recipient status). This eliminates the 403 race condition.

```
Before:
  const [meta, memory] = await Promise.all([
    resolveShareToken(token, session.access_token),
    fetchSharedContent(token, session.access_token),
  ]);

After:
  const meta = await resolveShareToken(token, session.access_token);
  const memory = await fetchSharedContent(token, session.access_token);
```

---

## Technical Details

- **No edge function changes needed** -- the backend logic is correct; the race condition is purely a client-side sequencing issue.
- **No changes to Memories.tsx** -- the `pendingShareToken` path remains as a fallback; no modifications required.
- **Only `SharedMemory.tsx` is modified** -- two small, targeted changes.

