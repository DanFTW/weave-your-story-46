
# Fix: Shared Memories Fail for Non-LIAM (Local) Memories

## Root Cause

The `fetch-shared-memory` edge function action retrieves memory content by querying the LIAM API using the owner's credentials. This works for memories created through LIAM, but **fails for local memories** (Instagram, Twitter, YouTube) because those memories are never stored in LIAM -- they only exist in the browser.

The database confirms: share token `b8f4f659-6c87-4daf-804b-b25afa910a85` maps to `memory_id: instagram-local-18252933193290744`. The LIAM API has no record of this memory, so the edge function returns 404 "Memory no longer available."

This affects all memory types with IDs prefixed `instagram-local-`, `twitter-local-`, or similar.

## Solution: Store Memory Content at Share-Creation Time

Instead of relying on LIAM to retrieve content at view time, store a snapshot of the memory content in the `memory_shares` table when the share is created. The `fetch-shared-memory` action then returns this stored snapshot directly, eliminating the LIAM dependency entirely.

This is more robust for all memory types and also faster (no LIAM round-trip at view time).

## Changes

### 1. Database Migration: Add `memory_content` Column

Add a JSONB column `memory_content` to the `memory_shares` table to store a snapshot of the shared memory.

```sql
ALTER TABLE memory_shares
ADD COLUMN memory_content jsonb;
```

### 2. Edge Function: `supabase/functions/memory-share/index.ts`

**`create` action:** Accept an optional `memory_content` field in the request body and store it in the new column. The client sends the memory's content, tag, and creation date at share time.

**`fetch-shared-memory` action:** Check if `memory_content` is stored in the share record. If yes, return it directly (no LIAM call needed). If no (legacy shares created before this change), fall back to the existing LIAM lookup.

This ensures backward compatibility with existing shares while fixing all future shares.

### 3. Frontend: `src/components/memories/ShareMemoryModal.tsx`

Update `handleCreateShare` to include the memory's content in the `create` request body:

```
body: {
  action: "create",
  memory_id: memory.id,
  share_scope: scope,
  memory_content: {
    content: memory.content,
    tag: memory.tag,
    created_at: memory.createdAt,
  },
  ...other fields
}
```

The `Memory` type already has `content`, `tag`, and `createdAt` fields, so no type changes are needed.

## Technical Details

### Database column
- Column: `memory_content jsonb` (nullable for backward compatibility)
- Contains: `{ "content": "...", "tag": "...", "created_at": "..." }`

### Edge function `create` action change
- Accept `memory_content` from request body
- Pass it to the `memory_shares` insert

### Edge function `fetch-shared-memory` action change
- After resolving the share and verifying the recipient, check `share.memory_content`
- If present: return it directly as the response (no LIAM call)
- If absent (legacy): fall back to existing LIAM fetch logic

### ShareMemoryModal change
- Add `memory_content` field to the `supabase.functions.invoke` call body

## No Other Changes

- `SharedMemory.tsx` already handles the response format correctly
- `useSharedWithMe.ts` is unaffected (it only lists shares, doesn't fetch content)
- RLS policies are unaffected (the edge function uses the admin client)

## Expected Result

1. User shares any memory type (LIAM, Instagram, Twitter, YouTube)
2. Memory content is stored as a snapshot in `memory_shares.memory_content`
3. Recipient opens share link
4. Edge function returns stored content directly -- works for all memory types
5. Recipient sees the memory content reliably
