
Goal
- Ensure `/oauth-complete` always reads Slack `code/state` from the original URL before Supabase can strip query params, without changing Composio logic or other files.

What I verified (current state)
1) Repository code
- `src/pages/OAuthComplete.tsx` already uses:
  - `const originalSearchRef = useRef(new URLSearchParams(window.location.search));`
  - `params = originalSearchRef.current`
  - `useEffect(..., [])`
- No `useSearchParams()` usage in this file.
- Composio branch remains unchanged and still reads from the same `params` object.

2) Runtime evidence
- Published test URL:
  - `https://weave-your-story-46.lovable.app/oauth-complete?code=test123&state=slack_testuser`
  - renders `Connection incomplete` + `Received: {"code":"test123","state":"slack_testuser"}`
- This output means deployed code is still taking the fallback path (not entering Slack callback branch as current repo code would for `state=slack_*`).

3) Edge logs pattern
- Repeated `slack-oauth: initiate for user ...`
- No organic callback completion logs (`saved for user ...`) from real user flow.
- Confirms callback handler is not being reached in the live flow.

Failure log (confirmed)
- Failure: Slack connect ends on `Connection incomplete`.
- Reason: published frontend behavior does not match current repo logic for `/oauth-complete`.
- Pattern: initiate succeeds, callback not executed, no DB connected row.

Implementation plan (single-file only, no Composio changes)
1) Re-assert OAuth param snapshot in `src/pages/OAuthComplete.tsx`
- Keep param capture strictly from `window.location.search` at first render via `useRef`.
- Ensure all callback parsing (`code`, `state`, `connected_account_id`, etc.) uses that same captured ref.
- Do not modify Composio callback flow logic; only param source consistency.

2) Add a temporary deterministic deploy marker (in same file only)
- Add one unique console marker in Slack detection block (e.g., `OAuthComplete marker: ref-snapshot-v2`) to verify that the published bundle is actually the latest.
- This is purely for deployment verification and can be removed after confirmation.

3) Redeploy published app
- Trigger a fresh publish so the updated bundle is live on `weave-your-story-46.lovable.app`.

Verification plan (must pass)
1) Deployed-code check
- Hit published URL with synthetic params:
  - `/oauth-complete?code=test123&state=slack_testuser`
- Expected with correct deploy:
  - NOT `Connection incomplete`
  - Should enter Slack callback branch and produce Slack callback error state for invalid code (e.g., “Failed to complete Slack connection”), proving branch execution.

2) Edge-log check
- `slack-oauth` logs must show:
  - `exchanging code for token...` for the synthetic test
  - then real flow should show `saved for user ...` on valid authorization.

3) Real end-to-end check
- Start from published `/integration/slack`.
- Complete Slack OAuth.
- Confirm `user_integrations` row exists for `integration_id='slack'` with `status='connected'`.
- Confirm integration UI shows connected state.

Acceptance criteria
- OAuthComplete reads params from captured `window.location.search` (no `useSearchParams` dependency in this page).
- Published domain behavior matches repo behavior.
- Slack callback branch executes on published domain and persists connection.
