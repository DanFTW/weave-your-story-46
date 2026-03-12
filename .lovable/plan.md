

## Root Cause Found: Supabase Auth Steals the `?code=` Parameter

The Supabase client is configured with `detectSessionInUrl: true` (the default). When the page loads at `/oauth-complete?code=SLACK_CODE&state=slack_USER_ID`, the Supabase Auth library detects `?code=` in the URL, interprets it as a PKCE authentication code, and calls `window.history.replaceState()` to strip the query parameters from the URL.

By the time React's `useEffect` fires and reads `useSearchParams()`, the URL has already been cleaned to `/oauth-complete` with no params. That is why:
- `window.location.href` initially logs the correct URL (captured before Supabase finishes processing)
- `Object.fromEntries(searchParams.entries())` returns `{}` (React Router's location is now the stripped URL)
- `searchParams.get("code")` returns `null`
- The Slack branch is skipped, falling through to the Composio "Connection incomplete" error

This also explains why the screenshot shows `{"code":"..."}` with no `state` -- once Supabase partially processes or strips params, the remaining state depends on timing.

## Fix (single file: `src/pages/OAuthComplete.tsx`)

Capture the raw query parameters synchronously using `window.location.search` **before** Supabase can strip them. Use a `useRef` initialized at render time (not in `useEffect`) to snapshot the original params:

```typescript
// At the top of the component, BEFORE any effects:
const originalSearchRef = useRef(new URLSearchParams(window.location.search));
```

Then inside `completeOAuth`, use `originalSearchRef.current.get("code")` instead of `searchParams.get("code")`, and the same for all other `.get()` calls.

This ensures the Slack callback params survive Supabase's URL stripping. No changes to the Composio path logic, only the source of params changes.

## Technical Details

- **What changes**: Replace all `searchParams.get(...)` and `searchParams.entries()` calls in the `completeOAuth` function with reads from `originalSearchRef.current`
- **Remove**: The `useSearchParams` dependency from the `useEffect` deps array (replace with empty `[]` since we read from the ref)
- **Keep**: `useSearchParams` import can stay for any future use, but the core logic no longer depends on it

