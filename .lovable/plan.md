

# Fix: Persistent Shared Memory Access + Owner Revocation

## Problem Identified

Two issues found:

1. **Pre-snapshot shares fail on subsequent visits**: Shares created before the snapshot feature was added have no `memory_content` stored. They fall back to the LIAM API, which has a retention cap -- causing "Memory no longer available" errors for older memories. 6 of the 10 most recent shares in the database lack snapshots.

2. **No owner revocation UI**: There is no way for the memory owner to revoke or manage their shared memories. The user wants a "manage shared memories" option.

3. **Navigation bug**: The `hasLoadedRef` in `SharedMemory.tsx` never resets when the `token` param changes, so navigating between shared memories without a full page reload silently fails.

## Solution

### 1. Backfill Snapshots on First Successful LIAM Fetch
**File: `supabase/functions/memory-share/index.ts`**

In the legacy LIAM fallback path (around line 529), after successfully finding the memory, write the content back to `memory_shares.memory_content` so all future visits use the snapshot directly. This is a one-time backfill per share.

```
// After finding the memory from LIAM, backfill the snapshot
const backfillContent = {
  content: found.memory || found.content || "",
  tag: found.notesKey || found.tag || null,
  created_at: found.date || null,
};
await adminClient
  .from("memory_shares")
  .update({ memory_content: backfillContent })
  .eq("id", share.id);
```

### 2. Add `revoke` Action to Edge Function
**File: `supabase/functions/memory-share/index.ts`**

Add a new `revoke` action that allows the share owner to delete a share and all its recipient records (cascade handled by the foreign key). Requires authentication and verifies ownership.

### 3. Add `list-my-shares` Action to Edge Function
**File: `supabase/functions/memory-share/index.ts`**

Add a new action that returns all shares the authenticated user has created, including recipient details. This powers the management UI.

### 4. Fix `hasLoadedRef` Bug
**File: `src/pages/SharedMemory.tsx`**

Reset `hasLoadedRef.current = false` at the start of the `useEffect` callback so that changing tokens (navigating between shared memories) correctly re-fetches.

### 5. Owner "Manage Shared Memories" UI
**New file: `src/components/memories/ManageSharedMemories.tsx`**

A drawer/sheet component accessible from the memory detail page or profile that shows all memories the user has shared, with the ability to revoke access. Each card shows: memory snippet, recipient list, share scope, and a "Revoke" button.

**New file: `src/hooks/useMyShares.ts`**

A hook that calls the `list-my-shares` action and the `revoke` action, managing state for the management UI.

### 6. Entry Point for Management
**File: `src/pages/Profile.tsx`** (or equivalent settings area)

Add a "Manage Shared Memories" menu item that opens the management drawer, keeping it discoverable without cluttering the main memory views.

## What Stays the Same
- All existing share creation flows
- RLS policies (owner delete policy already exists)
- Recipient access patterns
- The SharedWithMeList component

