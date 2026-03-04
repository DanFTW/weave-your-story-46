### Preliminary investigation completed (no code changes)

Do I know what the issue is? **Yes**. I traced the full `/integration/googlemaps` account-switch workflow across UI, hook state, edge functions, network behavior, and Composio API contract.

### What I verified

1. **"Change account" click is firing and workflow runs**
  - `IntegrationDetail.tsx` calls `disconnect()` then `connect(..., true)`.
  - Edge logs confirm:
    - `composio-disconnect` succeeds
    - `composio-connect` creates a **new** connected account ID
    - `composio-callback` upserts a fresh `user_integrations` row
2. **So this is not a broken button / not a failed reconnect**
  - DB currently shows a valid connected `googlemaps` row with the latest Composio connection ID.
3. **Why it still looks "wrong"**
  - In `composio-callback`, Google Maps profile fetch attempts Google `userinfo`.
  - Logs show `Google userinfo failed: 401` for Maps token (scope is `cloud-platform`).
  - Then callback falls back to `fetchExistingGoogleProfile(...)`, which pulls identity from **another Google integration** (e.g. Drive/Gmail), and writes that to `googlemaps`.
  - This can make Maps appear tied to `daniel@weave.cloud` even when account switching happened.
4. **Secondary issue**
  - `composio-connect` sends `force_reauth`, but Composio `connected_accounts/link` docs do not list that field as supported.
  - So account picker forcing may be unreliable depending on provider/auth-config behavior.

### Root cause (preliminary)

The persistent "same account" symptom is mainly an **identity attribution bug**, not a connection bug:

- Maps token cannot reliably return profile (401),
- app falls back to cross-integration identity,
- UI shows potentially inherited/stale Google identity.

### Fix — proceed with #1 only

**Stop cross-integration identity inheritance for Google Maps when userinfo is unverified (401).**

- Do not write another integration's email/name into `googlemaps`.
- If identity is unverifiable, store null and show a neutral connected state in the UI.

### Files/workflows implicated

- `supabase/functions/composio-callback/index.ts` (Google Maps + cross-integration fallback path)

Do not make any other changes.