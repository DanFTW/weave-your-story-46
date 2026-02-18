
# Memory Sharing Feature

## Architecture Overview

The sharing feature needs:
1. A **database layer** — two new tables: `memory_shares` (share records) and `memory_share_recipients` (per-recipient rows)
2. A **backend edge function** — `memory-share` for secure share creation and recipient email lookup
3. A **share modal** — bottom-sheet style popup triggered from the MemoryCard's share button
4. A **shared memory view** — a public `/shared/:token` route that resolves the token and displays the memory
5. **MemoryCard + MemoryStack wiring** — add a share icon/button without breaking existing click-to-navigate behavior

---

## Database Schema (2 new tables)

### `memory_shares`
Stores one record per share action:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_user_id` | uuid | sharer's auth UID |
| `memory_id` | text | LIAM memory ID (or thread tag for all-from-thread) |
| `share_scope` | text | `'single'` \| `'thread'` \| `'custom'` |
| `share_token` | text UNIQUE | random URL-safe token for the link |
| `custom_condition` | text nullable | free-text custom condition (trigger word, person, time, place) |
| `thread_tag` | text nullable | for thread-scope shares |
| `expires_at` | timestamptz nullable | optional expiry |
| `created_at` | timestamptz | `now()` |

### `memory_share_recipients`
One row per recipient per share:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `share_id` | uuid FK → `memory_shares.id` ON DELETE CASCADE |
| `recipient_email` | text | lowercased email |
| `recipient_user_id` | uuid nullable | resolved if they have an account |
| `viewed_at` | timestamptz nullable | set on first view |
| `created_at` | timestamptz | `now()` |

### RLS Policies
- `memory_shares`: owner can SELECT/INSERT/DELETE where `owner_user_id = auth.uid()`
- `memory_share_recipients`: owner can SELECT/INSERT/DELETE via join on `memory_shares`
- Public SELECT on `memory_shares` by `share_token` (for the shared link view — service role reads via edge function)
- No UPDATE needed for either table

---

## Edge Function: `memory-share`

Single function with two actions dispatched by `action` field in POST body:

### Action: `create`
- Auth required (reads JWT)
- Validates: memory_id, scope, recipients (array of emails, max 50, valid email format)
- Generates a `share_token` using `crypto.randomUUID()` (URL-safe, 36 chars)
- Inserts into `memory_shares`
- For each recipient email:
  - Looks up `auth.users` via admin client to find if they have an account → sets `recipient_user_id`
  - Inserts into `memory_share_recipients`
- Returns `{ share_token, share_url }`

### Action: `resolve`
- No auth required
- Takes `{ share_token }`
- Looks up `memory_shares` by token using service role
- Returns share metadata: `{ memory_id, share_scope, custom_condition, thread_tag, owner_user_id }`
- Does NOT return the memory content (the client then fetches that separately, maintaining the LIAM memory API as the single source of truth)
- Records `viewed_at` on the first recipient row that matches the caller's IP (best-effort, not critical)

---

## New Frontend Components

### 1. `src/components/memories/ShareMemoryModal.tsx`

A bottom-sheet (`vaul` Drawer — already installed) with three steps:

**Step 1 — Scope selection**
- "Just this memory" (single)
- "All memories from this thread / tag" (thread) — shows a tag picker if selected
- "Custom condition" (custom) — reveals a text input for the trigger word/person/time/place

**Step 2 — Add recipients**
- Search input: type an email address
- "Add" button validates email format with zod before adding
- Recipient chips displayed below input (each removable with ×)
- Max 20 recipients enforced client-side with a friendly message

**Step 3 — Confirm & copy**
- Summary card showing: scope, condition (if custom), recipient count
- "Create share link" button → calls `memory-share` edge function action `create`
- On success: shows the share URL in a read-only input with a "Copy link" button (uses `navigator.clipboard.writeText`)
- Success state shows a checkmark and "Link copied!" toast

### 2. `src/pages/SharedMemory.tsx`

Public route `/shared/:token` — no auth required:

- Calls `memory-share` edge function action `resolve` with the token
- Displays: a minimal read-only view of the memory's `memory_id` content preview, the sharer's display name (from `profiles`), and share scope / custom condition
- Since the actual memory content lives in LIAM API (auth-gated), this page shows:
  - The share metadata (scope, custom condition, tag)
  - A CTA: "View this memory in the app" → deep-link to `/memory/:id` (requires login)
  - If the viewer is already logged in and is a listed recipient → show full content by calling LIAM API on their behalf (handled inside the component with `useAuth`)
- If token not found → "This share link is invalid or has expired"

---

## Wiring into Existing Components

### `MemoryCard.tsx`
- Add a `Share` (`lucide-react`) icon button in the card footer area (right-aligned, next to "Synced" badge)
- Clicking the share icon calls `onShare(memory)` prop (stops propagation so the card click-to-navigate doesn't fire)
- `onShare` is optional prop — when not provided, the button is hidden

### `MemoryDateGroup.tsx` + `MemoryStack.tsx`
- Pass `onShare` down from `MemoryList` → `MemoryDateGroup` → `MemoryCard` / `MemoryStack`
- `MemoryStack` exposes the share button on the collapsed stack header

### `MemoryList.tsx`
- Accepts `onShare?: (memory: Memory) => void` prop
- Passes it through to date groups

### `Memories.tsx` (page)
- Adds `sharingMemory: Memory | null` state
- Passes `onShare={(m) => setSharingMemory(m)}` to `MemoryList`
- Renders `<ShareMemoryModal memory={sharingMemory} open={!!sharingMemory} onOpenChange={(open) => !open && setSharingMemory(null)} />`

### `App.tsx`
- Adds `<Route path="/shared/:token" element={<SharedMemory />} />` as a public route (outside `ProtectedRoute`)

---

## Files to Create / Modify

| File | Action |
|---|---|
| `supabase/migrations/XXXX_memory_shares.sql` | Create `memory_shares` + `memory_share_recipients` tables with RLS |
| `supabase/functions/memory-share/index.ts` | New edge function (create + resolve actions) |
| `src/components/memories/ShareMemoryModal.tsx` | New component — bottom drawer with 3-step share flow |
| `src/pages/SharedMemory.tsx` | New public page for viewing shared memory links |
| `src/components/memories/MemoryCard.tsx` | Add optional `onShare` prop + share icon button |
| `src/components/memories/MemoryStack.tsx` | Thread-through `onShare` prop |
| `src/components/memories/MemoryDateGroup.tsx` | Thread-through `onShare` prop |
| `src/components/memories/MemoryList.tsx` | Thread-through `onShare` prop |
| `src/pages/Memories.tsx` | Wire up `sharingMemory` state + `ShareMemoryModal` |
| `src/App.tsx` | Add `/shared/:token` public route |

---

## Key Technical Decisions & 2026 Best Practices

- **Token generation**: `crypto.randomUUID()` in Deno edge function — cryptographically secure, no external dependency
- **Email validation**: zod `z.string().email()` client-side before add, same schema re-validated in edge function
- **No memory content stored in DB**: The share record only stores the `memory_id`. Content is always fetched live from the LIAM API, preserving a single source of truth and avoiding stale data
- **Propagation stop**: Share icon `onClick` calls `e.stopPropagation()` before `onShare(memory)` — prevents navigation to memory detail page
- **`vaul` Drawer**: Already installed. Used as a bottom sheet on mobile (matches existing app patterns like `QuickMemoryDrawer`)
- **Service role for resolve**: The `resolve` action in the edge function uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for token lookup — the token itself is the authorization credential
- **Recipient lookup**: Uses Supabase admin `auth.admin.listUsers()` filtered by email to optionally link share recipients to existing accounts — purely informational, no access gate required
- **Share scope "thread"**: Uses `memory.tag` as the thread identifier (the existing tagging system already maps memories to sources like TWITTER, INSTAGRAM, etc.) — no new data model required
