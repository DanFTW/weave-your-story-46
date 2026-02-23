

# Remove Resend Email Dependency from Memory Sharing

## What's happening now
The sharing flow already correctly restricts access to invited emails -- only users who sign in/sign up with an invited email address can view "Invited only" shares. However, the edge function still attempts to send invite emails via Resend (which fails silently because the free tier can't deliver to arbitrary addresses).

## Changes

### 1. Edge function: `supabase/functions/memory-share/index.ts`
- Remove the `sendShareEmail` function entirely (lines 20-61)
- Remove the `RESEND_API_KEY` constant (line 12)
- Remove the `Promise.allSettled(... sendShareEmail ...)` call in the `create` action (line 276)

This eliminates dead code and the silent failure. The access control enforcement (already in the `resolve` action) continues to work -- only users whose email matches an invited recipient can access the memory.

### 2. Frontend: `src/components/memories/ShareMemoryModal.tsx`
- Update the `successSubtitle` for the "Invited only" case (around line 399-403) to make it clear the user needs to share the link manually:
  - When recipients exist: "Share this link with your recipients. Only they can access it by signing in with their invited email."
  - When no recipients + recipients_only: "Copy and share this link. Recipients will need to sign in with their email to view."

### What stays the same
- The visibility toggle (Invited only / Anyone with link) -- unchanged
- The recipient email input UI -- unchanged
- The `resolve` action's access control logic -- unchanged (already blocks non-invited users with 403)
- The `SharedMemory.tsx` error handling -- unchanged (already shows "Access restricted" for blocked users)
- The share link generation and copy/share functionality -- unchanged

## How it works end-to-end
1. User creates a share with "Invited only" and adds recipient emails
2. Backend stores the share with `visibility: 'recipients_only'` and records recipients
3. User copies/shares the link manually (via copy button or native share sheet)
4. Recipient opens the link, signs in or signs up with their email
5. Backend checks their email against the recipients list -- grants or denies access
