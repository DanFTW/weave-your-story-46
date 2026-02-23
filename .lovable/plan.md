
# Fix: Older Shared Memories Returning "Link Not Found"

## Root Cause

The `fetch-shared-memory` action in the edge function retrieves **all** of the owner's memories from the LIAM API via `/memory/list`, then searches for the specific shared memory by ID. The LIAM API returns a limited/capped set of memories (no pagination controls), so **older memories fall outside this window** and can no longer be found -- resulting in a 404 "Memory no longer available" error even though the share link itself is perfectly valid.

## Solution: Snapshot at Share Time

Store the memory content in the `memory_shares` table at the moment the share is created. When viewing a shared memory, use this stored snapshot directly instead of relying on the LIAM API lookup. This makes shared memories permanently accessible regardless of the LIAM API's retention window.

## Changes

### 1. Database Migration
Add a `memory_content` column to the `memory_shares` table:

```sql
ALTER TABLE public.memory_shares
  ADD COLUMN memory_content jsonb DEFAULT NULL;
```

This stores a JSON snapshot of the memory (content, tag, title, created_at) at share time.

### 2. Frontend: `src/components/memories/ShareMemoryModal.tsx`
In the `handleCreateShare` function (~line 318), include the memory's content, tag, and creation date in the request body sent to the `create` action:

```
memory_content: {
  content: memory.content,
  tag: memory.tag,
  created_at: memory.createdAt,
}
```

No other UI changes needed.

### 3. Edge Function: `supabase/functions/memory-share/index.ts`

**`create` action (~line 142):**
- Destructure `memory_content` from the request body.
- Store it in the `.insert()` call alongside the other fields.

**`fetch-shared-memory` action (~line 405-490):**
- Add `memory_content` to the `.select()` query when resolving the share.
- If `memory_content` is present (snapshot exists), return it directly without calling the LIAM API at all.
- Only fall back to the LIAM API lookup for legacy shares that were created before the snapshot column existed.

## What Stays the Same
- The `resolve` action (landing page metadata) -- unchanged.
- The `SharedMemory.tsx` page -- unchanged (already renders whatever `fetch-shared-memory` returns).
- The share creation UI flow -- unchanged aside from sending additional data.
- Access control logic (visibility, recipient checks) -- unchanged.

## End-to-End Flow After Fix

1. User opens share modal for a memory
2. Frontend sends memory content snapshot along with the create request
3. Backend stores the snapshot in `memory_content` column
4. When a recipient views the share link, the backend returns the stored snapshot directly
5. No LIAM API call needed -- shared memories are permanently accessible
