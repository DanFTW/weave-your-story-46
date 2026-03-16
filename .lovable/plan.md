

## Plan: Fix Twitter auth config + surface expired/unenrolled errors

### 1. `supabase/functions/composio-connect/index.ts`
Update Twitter auth config ID on line 151:
```
twitter: "ac_4qhrV_9j3cxB"  →  twitter: "ac_5uSLoTdeFuN6"
```

### 2. `supabase/functions/twitter-alpha-tracker/index.ts`

Update the `search-user` action handler (lines 608-629) to detect and return structured error states instead of `{ user: null }`:

- After calling `searchTwitterUser`, check the raw Composio response for expired connection (`ConnectedAccountExpired`, `EXPIRED state`) and unenrolled app (`client-not-enrolled`, `403`) errors.
- Refactor `searchTwitterUser` to return a richer object: `{ user, error?, needsReconnect? }` instead of just `TrackedAccount | null`.
- When `needsReconnect` is true, return `{ user: null, needsReconnect: true, error: "..." }`.

Similarly wrap the `manual-poll` action (line 794-799) in a try/catch that detects expired connection errors and returns `{ needsReconnect: true }`.

### 3. `src/hooks/useTwitterAlphaTracker.ts`

Update `searchUsers` (lines 131-168) and `manualPoll` (lines 353-402) to check for `data?.needsReconnect`:
- When detected: show a destructive toast explaining the connection expired, disconnect Twitter via `useComposio`, set `sessionStorage` return key, and navigate to `/integration/twitter`.
- This mirrors what Instagram does but uses toast + redirect instead of a dedicated screen phase.

Add `useComposio('TWITTER')` import to the hook for the `disconnect` call.

