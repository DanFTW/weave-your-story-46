

# Fix: Shared Memory "View in App" Redirects to Wrong Page

## Problem

When a recipient clicks "View in app" on a shared memory link, they sign in and get redirected to `/memory/<memory_id>`. This page tries to load the memory from the LIAM API using the **recipient's** credentials, but the LIAM API only returns memories owned by that user. Since the memory belongs to someone else, the page shows "Memory not found."

## Root Cause

In `SharedMemory.tsx`, line 162 constructs a deep link pointing to the individual memory detail page:

```
const deepLink = `/memory/${data.memory_id}`;
```

This is then used in the "View in app" button (line 228) as the login redirect destination. The memory detail page was never designed to display other users' memories -- it only queries the current user's LIAM memory store.

## Fix

**File: `src/pages/SharedMemory.tsx`**

Change the "View in app" button's redirect destination from `/memory/<id>` to `/memories?view=shared`. The `pendingShareToken` is already saved to `localStorage` (line 109) before the user reaches login, and `Memories.tsx` already consumes it on mount to register the recipient and switch to the "Shared With Me" tab.

Specifically:
- Remove the `deepLink` variable (line 162) since it's no longer needed
- Update the Link `to` prop (line 228) from `/login?redirect=/memory/...` to `/login?redirect=/memories?view=shared`

This is a 2-line change. No other files need modification -- the existing `pendingShareToken` flow in `Memories.tsx` already handles recipient registration and tab switching correctly.

## Why This Works

The existing flow already handles everything after login:
1. `SharedMemory.tsx` saves the token to `localStorage` (already done on line 109)
2. `Login.tsx` redirects to the `?redirect=` param after sign-in (already working)
3. `Memories.tsx` reads `pendingShareToken` from localStorage, calls the edge function to register the recipient, and switches to the "Shared With Me" tab (already working)

The only broken piece was the redirect destination pointing to the wrong page.

