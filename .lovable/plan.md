
# Fix: Share Link Flow — Full End-to-End Repair

## Root Cause Analysis (Rubber Duck)

### Bug 1 — The most visible: 404 on the published site
The route `/s/:token` IS registered in `App.tsx` line 69. However, the screenshot URL is `weave-your-story-46.lovable.app/s/...` (the **published** site, not preview). The Lovable hosting layer serves a static SPA — when a user navigates directly to `/s/<token>`, the server has no file at that path and returns a 404 before React even loads. This is standard SPA deep-link behavior: the router only works client-side, once `index.html` is served. The `public/_redirects` (Netlify-style) or `vite.config.ts` needs a catch-all to serve `index.html` for all routes. Since Lovable uses Vite + its own hosting, the standard fix is ensuring the published app has a catch-all redirect. This is already handled by Lovable's infrastructure for preview links but may need a `public/_redirects` file for the published URL.

### Bug 2 — Authenticated users see the wrong page
`SharedMemory.tsx` renders a static "Memory content is private / View in app" card for **all** visitors, including already signed-in users. An authenticated user should be redirected straight to `/memories` (with the Shared With Me tab focused) or to the memory detail if it's a single memory.

### Bug 3 — Login page ignores `?redirect=` param
`Login.tsx` hardcodes `navigate('/', { replace: true })` when `user` is set. It never reads `?redirect=` from the URL. So even though `SharedMemory` correctly constructs `/login?redirect=%2Fmemory%2F...`, the redirect is silently discarded after login.

### Bug 4 — Recipient not registered on share link visit
`SharedMemory.tsx` calls `resolveShareToken` with only the `apikey` header — no `Authorization` header. The edge function's `resolve` action has logic to mark a recipient as viewed (`viewed_at`) if the caller is authenticated, but since no auth token is sent, it can never match the visiting user. This means authenticated users who click a share link never appear in `memory_share_recipients` and the share never shows up in their "Shared With Me" tab.

### Bug 5 — New user post-signup redirect
`useAuth.signUp()` hardcodes `emailRedirectTo: window.location.origin + '/'`. A new user who signed up via the share link flow (arriving from `/login?redirect=/memories?shared=<token>`) will, after email confirmation, land on `/` rather than the shared memory. The redirect intent must be preserved through the email confirmation cycle using `localStorage`.

---

## The Fix — Minimal, Targeted Changes

### 1. `public/_redirects` (NEW FILE)
Add a Netlify/Lovable-style SPA catch-all so the published site doesn't 404 on deep links:
```
/*  /index.html  200
```
This ensures `/s/<token>` serves `index.html` so React Router can take over.

### 2. `src/pages/SharedMemory.tsx`
Two changes:
- **Auth-aware rendering**: Import `supabase` client and check the current session on mount. If the user is already authenticated, pass their token with the `resolve` call (so the edge function can register them), then redirect them to `/memories` (the Shared With Me tab will pick up the new record) instead of showing the sign-in prompt.
- **Unauthenticated user flow**: If not authenticated, store the share token in `localStorage` as `pendingShareToken` before sending them to `/login`. The "View in app" button link already encodes the redirect but we need localStorage for the email confirmation path.

```typescript
// On mount, check session
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  // Call resolve WITH auth token so edge fn can register this viewer
  // Then redirect to /memories (Shared With Me tab)
}
// If not authed: save to localStorage before redirecting to login
```

### 3. `src/pages/Login.tsx`
Read the `?redirect=` query param and use it instead of `/` after successful login/signup:
```typescript
const [searchParams] = useSearchParams();
const redirectTo = searchParams.get('redirect') ?? '/';

useEffect(() => {
  if (!isLoading && user) {
    navigate(redirectTo, { replace: true });
  }
}, [user, isLoading, navigate, redirectTo]);
```

### 4. `src/hooks/useAuth.ts`
Pass the redirect intent through the email confirmation URL. When `signUp` is called, check if there's a `pendingShareToken` in `localStorage` and encode it into the `emailRedirectTo` URL so post-confirmation the user lands on the right page:
```typescript
const signUp = useCallback(async (email: string, password: string) => {
  const pendingToken = localStorage.getItem('pendingShareToken');
  const redirectUrl = pendingToken
    ? `${window.location.origin}/s/${pendingToken}`
    : `${window.location.origin}/`;

  const { error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectUrl }
  });
  return { error: error as Error | null };
}, []);
```

### 5. `src/pages/Memories.tsx`
On mount, check for `pendingShareToken` in `localStorage`. If found, resolve it using the authenticated Supabase client (to register the user as a recipient), clear the token, and switch the view to the "Shared With Me" tab:
```typescript
useEffect(() => {
  const pendingToken = localStorage.getItem('pendingShareToken');
  if (pendingToken && user) {
    supabase.functions.invoke('memory-share', {
      body: { action: 'resolve', share_token: pendingToken }
    }).then(() => {
      localStorage.removeItem('pendingShareToken');
      setActiveTab('shared'); // switch to "Shared with Me"
    });
  }
}, [user]);
```

---

## Data Flow After Fix

**Authenticated user visits `/s/<token>`:**
```text
/s/<token>  →  SharedMemory.tsx detects session
            →  calls resolve WITH auth token (registers viewer in DB)
            →  navigate('/memories') with Shared With Me tab active
```

**Unauthenticated user visits `/s/<token>`:**
```text
/s/<token>  →  SharedMemory.tsx shows landing card
            →  user taps "View in app"
            →  localStorage.setItem('pendingShareToken', token)
            →  navigate('/login?redirect=/memories')
            →  Login.tsx reads ?redirect, redirects after sign-in
            →  Memories.tsx detects pendingShareToken, resolves it
            →  Shared With Me tab shows the memory
```

**New user (email signup) visits `/s/<token>`:**
```text
/s/<token>  →  localStorage.setItem('pendingShareToken', token)
            →  navigate('/login')  →  user signs up
            →  emailRedirectTo includes /s/<token>
            →  email confirmation click → /s/<token>
            →  now authenticated → same flow as authenticated user above
```

---

## Files Changed

| File | Change |
|---|---|
| `public/_redirects` | NEW — SPA catch-all for published site |
| `src/pages/SharedMemory.tsx` | Auth-aware: detect session, redirect authed users, save token to localStorage for unauthed |
| `src/pages/Login.tsx` | Read `?redirect=` query param and use it post-login |
| `src/hooks/useAuth.ts` | `signUp` reads `pendingShareToken` from localStorage for `emailRedirectTo` |
| `src/pages/Memories.tsx` | On mount, consume `pendingShareToken`, resolve it, switch to Shared With Me tab |

No database migrations required. No edge function changes required.
