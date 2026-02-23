
# Fix: Enforce "Invited Only" Access Control and Email Invites

## Problem

The "Invited only" visibility option in the Share Memory modal is not actually enforced on the backend. Two issues:

1. **No `visibility` column**: The `memory_shares` table does not store the visibility setting, so the backend cannot distinguish between "Invited only" and "Anyone with link" shares.
2. **Auto-registration of any visitor**: The `resolve` action unconditionally registers any authenticated user who opens the share link as a recipient -- making "Invited only" behave identically to "Anyone with link."
3. **Email delivery**: The `sendShareEmail` function already exists and is called during share creation. It uses Resend with the test sender `onboarding@resend.dev`, which only delivers to the Resend account owner's email. For production delivery to arbitrary addresses, a verified custom domain must be configured in Resend (outside the scope of this code change, but noted).

## Solution

### 1. Database Migration

Add a `visibility` column to `memory_shares`:

```sql
ALTER TABLE memory_shares
  ADD COLUMN visibility text NOT NULL DEFAULT 'anyone';
```

Default is `'anyone'` so existing shares continue working as before.

### 2. Edge Function: `supabase/functions/memory-share/index.ts`

**`create` action (~line 227):**
- Destructure `visibility` from the request body.
- Store it in the `.insert()` call: `visibility: visibility || 'anyone'`.

**`resolve` action (~line 340-356):**
- Add `visibility` to the `.select()` on the share query.
- Change the auto-registration logic: only upsert the visiting user as a recipient when `visibility === 'anyone'`. When `visibility === 'recipients_only'`, skip auto-registration -- the user must already be in the recipients list from share creation.

**`fetch-shared-memory` action (no change):**
- The existing recipient check (lines 439-450) already enforces that only listed recipients can fetch content. Once `resolve` stops auto-registering uninvited users for `recipients_only` shares, this check naturally blocks unauthorized access.

### 3. Frontend: `src/pages/SharedMemory.tsx`

- Handle the 403/error case from `resolve` when a non-invited user tries to access a `recipients_only` share. Show a user-friendly message like "This memory was shared with specific people. You don't have access."

### 4. No other frontend changes

- `ShareMemoryModal.tsx` already sends `visibility` in the request body (line 326) and `recipients` (line 325). No changes needed.
- `sendShareEmail` is already called for all recipients on line 275. No changes needed.
- `useSharedWithMe.ts` and `SharedWithMeList.tsx` are unaffected.

## Technical Summary

| File | Change |
|------|--------|
| New migration SQL | Add `visibility text NOT NULL DEFAULT 'anyone'` to `memory_shares` |
| `memory-share/index.ts` | Store visibility on create; conditionally auto-register on resolve |
| `SharedMemory.tsx` | Handle "not invited" error gracefully |

## What This Does NOT Change

- The email sending mechanism (already implemented via Resend).
- The share creation UI (already sends visibility and recipients).
- Any other part of the codebase.

## Note on Email Delivery

The Resend test sender (`onboarding@resend.dev`) only delivers to the account owner's email. To send invite emails to arbitrary addresses in production, a verified sending domain must be added in the Resend dashboard and the `from` address in `sendShareEmail` updated accordingly. This is a configuration step, not a code change.
