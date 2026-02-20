

# Fix: `auth.getUser()` Returns Null in Edge Function

## Root Cause

The `memory-share` edge function has an inconsistency in how it verifies authentication:

- **`create` action (WORKS):** Manually decodes the JWT from the Authorization header to extract the user ID. Never calls `getUser()`.
- **`fetch-shared-memory` action (BROKEN):** Creates a fresh Supabase client with global headers and calls `userClient.auth.getUser()` without arguments. On a freshly-created server-side client, `getUser()` has no stored session to reference, so it returns `null` -- causing the 401 "Invalid or expired session" error.
- **`resolve` action (SILENTLY BROKEN):** Same `getUser()` pattern for recipient registration. Returns `null`, so the user is never registered as a recipient. This causes a cascading failure: even if `fetch-shared-memory` auth were fixed, the recipient check would fail with 403.

## Fix

### File: `supabase/functions/memory-share/index.ts`

Pass the extracted JWT explicitly to `auth.getUser(jwt)` instead of calling `auth.getUser()` with no arguments. This tells the Supabase Auth service to verify the specific token rather than relying on the client's non-existent session state.

**Change 1 -- `resolve` action (recipient registration, ~line 339-346):**

```
Before:
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user: authedUser } } = await userClient.auth.getUser();

After:
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user: authedUser } } = await adminClient.auth.getUser(jwt);
```

**Change 2 -- `fetch-shared-memory` action (~line 408-419):**

```
Before:
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { authorization: authHeader } },
  });
  const { data: { user: callerUser } } = await userClient.auth.getUser();

After:
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user: callerUser } } = await adminClient.auth.getUser(jwt);
```

Using `adminClient.auth.getUser(jwt)` (the service-role client) is the standard Supabase edge function pattern for verifying JWTs server-side. It delegates verification to the Supabase Auth service, which handles both HS256 and ES256 tokens correctly.

## No Other Files Change

- `SharedMemory.tsx` is correct: it passes the access token explicitly via raw `fetch` with `Authorization: Bearer` header
- `useAuth.ts` OAuth redirect handling is correct
- `Login.tsx` redirect flow is correct
- Frontend routing is correct

## Expected Result After Fix

1. User opens share link, sees landing card, clicks "Sign in to view"
2. Signs in, redirected back to `/s/<token>`
3. `resolveShareToken` called with auth -- `getUser(jwt)` succeeds, user registered as recipient
4. `fetchSharedContent` called with auth -- `getUser(jwt)` succeeds, recipient check passes, memory content returned
5. User sees the shared memory content

