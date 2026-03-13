

## Plan: Fix LIAM API Call in slack-messages-sync

### Root Cause

The slack-messages-sync function calls `https://web.askbuddy.ai/api/memories` with custom `x-api-key`/`x-user-key` headers. This endpoint doesn't exist (404). Every other working edge function uses:

- **URL:** `https://web.askbuddy.ai/devspacexdb/api/memory/create`
- **Auth:** ECDSA-signed requests with `apiKey` and `signature` headers
- **Body:** `{ userKey, content }` (not `{ content, tags }`)

The function also uses env var keys (`LIAM_API_KEY`, `LIAM_PRIVATE_KEY`, `LIAM_USER_KEY`) rather than per-user keys from `user_api_keys`. Since the env vars are already in place and working for other functions, we'll keep using them but switch to proper ECDSA signing.

### Changes to `supabase/functions/slack-messages-sync/index.ts`

**1. Add crypto utilities and createMemory helper** (after line 8, before `serve`):
- Add `removeLeadingZeros`, `constructLength`, `toDER`, `importPrivateKey`, `signRequest` functions (copied from working todoist function)
- Add `LIAM_API_BASE = "https://web.askbuddy.ai/devspacexdb/api/memory"`
- Add `createMemory(apiKey, privateKeyPem, userKey, content)` helper that signs and POSTs to `${LIAM_API_BASE}/create`

**2. Update poll action** (lines 214-230):
- Replace the raw `fetch("https://web.askbuddy.ai/api/memories", ...)` block with a call to the new `createMemory` helper
- Body becomes `{ userKey, content }` with proper `apiKey` + `signature` headers
- Keep debug logging

**3. Update search action** (lines 318-340):
- Same change: replace the raw fetch with `createMemory` helper call

No other logic changes. The deduplication, message filtering, and config updates remain identical.

