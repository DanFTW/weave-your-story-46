

# Fix: Shared Memories for Non-LIAM (Local) Memories

## Problem
The `fetch-shared-memory` action always queries the LIAM API to retrieve content. Local memories (Instagram, Twitter, YouTube) with IDs like `instagram-local-*` don't exist in LIAM, so sharing them returns 404.

## Solution
Store a content snapshot in `memory_shares` at share-creation time. Return it directly at fetch time, falling back to LIAM only for legacy shares.

## Changes

### 1. Database Migration
```sql
ALTER TABLE memory_shares ADD COLUMN memory_content jsonb;
```
Nullable column -- no impact on existing rows.

### 2. Edge Function: `supabase/functions/memory-share/index.ts`

**`create` action (line 184):**
- Destructure `memory_content` from the request body alongside existing fields.
- Include `memory_content: memory_content || null` in the `.insert()` call (line 227).

**`fetch-shared-memory` action (lines 418-538):**
- Add `memory_content` to the `.select()` on line 421.
- After recipient verification (line 451), check if `share.memory_content` exists.
- If yes: skip all LIAM logic (lines 453-503), return the snapshot directly using the same response shape.
- If no: fall back to the existing LIAM fetch (unchanged).

### 3. Frontend: `src/components/memories/ShareMemoryModal.tsx`

**`handleCreateShare` (line 318):**
- Add `memory_content` to the invoke body:
```typescript
memory_content: {
  content: memory.content,
  tag: memory.tag,
  created_at: memory.createdAt,
},
```

## No Other Changes Needed
- `SharedMemory.tsx` already parses the response shape correctly.
- `useSharedWithMe.ts` is unaffected.
- RLS policies are unaffected (edge function uses admin client).

