

# Fix: "Link not found" After Sign-In on Shared Memory Page

## Root Cause Analysis

The console screenshot reveals the exact failure sequence:
1. `INITIAL_SESSION no session` -- page loads, no session yet
2. `SIGNED_IN session exists` -- OAuth tokens processed
3. `INITIAL_SESSION session exists` -- session confirmed
4. `memory-share` returns **401** -- edge function rejects the request

Two bugs cause this:

### Bug 1: `fetchSharedContent` ignores the explicit access token
The function signature accepts `accessToken` but **never uses it**. Instead it calls `supabase.functions.invoke()` which relies on the Supabase client's internal session state. After an OAuth redirect, the client's internal session may not be fully synchronized yet, so the request is sent **without** an Authorization header, triggering a 401 from the edge function.

```text
// Current code (broken):
async function fetchSharedContent(token: string, accessToken: string) {
  // accessToken is IGNORED -- uses supabase client's internal session
  const res = await supabase.functions.invoke("memory-share", { ... });
}
```

### Bug 2: Auth state race condition after OAuth redirect
The `useEffect` calls `supabase.auth.getSession()` once on mount. After an OAuth redirect, the URL contains hash fragments that Supabase processes asynchronously. `getSession()` can return `null` before processing completes, causing the component to fall into the "unauthenticated" landing path. When the session eventually arrives (via `onAuthStateChange`), the `useEffect` does not re-run because its dependency (`token`) hasn't changed.

---

## Proposed Changes

### File: `src/pages/SharedMemory.tsx`

**Fix A -- Use raw `fetch` with explicit auth token in `fetchSharedContent`:**
Replace `supabase.functions.invoke` with a raw `fetch` call that explicitly includes the access token in the Authorization header, matching how `resolveShareToken` already works. This eliminates the dependency on the Supabase client's internal session state.

```text
Before:
  const res = await supabase.functions.invoke("memory-share", {
    body: { action: "fetch-shared-memory", shareToken: token },
  });

After:
  const res = await fetch(
    `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/memory-share`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: "fetch-shared-memory", shareToken: token }),
    },
  );
```

**Fix B -- Subscribe to `onAuthStateChange` to handle OAuth redirect timing:**
Instead of only calling `getSession()` once on mount, also subscribe to auth state changes. When a `SIGNED_IN` event fires (which happens after OAuth tokens are processed), trigger the resolve + fetch flow with the now-available session. This handles the case where `getSession()` returns null initially because the OAuth hash hasn't been processed yet.

The `useEffect` will:
1. Set up an `onAuthStateChange` listener
2. Call `getSession()` for the initial check
3. When the listener fires `SIGNED_IN` with a session, run the resolve + fetch flow
4. Use a flag to prevent running the flow twice (once from getSession, once from listener)
5. Clean up the subscription on unmount

---

## No Other Files Change

- The edge function (`memory-share`) is correct -- it properly returns 401 when no auth header is present
- `Login.tsx` correctly reads the `redirect` param and redirects after sign-in
- `useAuth.ts` correctly sets OAuth redirect URLs with `pendingShareToken`
- `config.toml` already has `verify_jwt = false` for `memory-share`

## End-to-End Flow After Fix

1. Recipient opens `https://weave-your-story-46.lovable.app/s/<token>`
2. No session found -- landing card displayed, token stored in localStorage
3. User clicks "Sign in to view" -- goes to `/login?redirect=/s/<token>`
4. User signs in (email or OAuth)
5. Redirected back to `/s/<token>`
6. `onAuthStateChange` fires `SIGNED_IN` with valid session
7. `resolveShareToken` called with explicit access token -- registers recipient
8. `fetchSharedContent` called with explicit access token -- returns memory content
9. Memory displayed in the authenticated view
10. User clicks "View all shared memories" -- navigates to `/memories?view=shared`

