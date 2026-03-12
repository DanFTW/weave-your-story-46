
Investigation complete (no code changes made). Root cause is confirmed with high certainty.

What I validated
1) Source implementation (current repo)
- `src/pages/OAuthComplete.tsx` contains a Slack-first callback branch (`code` + `state` containing `slack`) before Composio logic.
- `supabase/functions/slack-oauth/index.ts` has both `initiate` and `callback` handlers and writes to `user_integrations`.

2) Runtime behavior observed
- Client network shows `POST /functions/v1/slack-oauth` with `{"action":"initiate"}` succeeds and returns redirect URL with `state=slack_<userId>`.
- Then repeated polling requests to `user_integrations` for `integration_id=slack` return `[]` (never connected).

3) Edge-function logs
- `slack-oauth` logs repeatedly show only: `initiate for user ...`
- No organic callback logs (`exchanging code`, `saved for user`) during user flow.

4) Direct published-route reproduction
- Fetching published route with Slack-like params:
  `/oauth-complete?code=test&state=slack_test`
  renders: **“Connection incomplete”** and echoes `{code,state}`.
- That output is the Composio fallback path (`connectionId` missing), proving published `/oauth-complete` is not executing Slack callback handling.

5) Controlled backend callback test
- Manually invoking `slack-oauth` with `action:"callback"` logs `exchanging code` and returns Slack `invalid_code` as expected.
- This proves backend callback path is reachable and functioning; it is simply not being called in real flow.

Failure chain (confirmed)
```text
/integration/slack (preview) -> slack-oauth initiate OK -> Slack redirects to published /oauth-complete
-> published /oauth-complete runs Composio fallback (expects connected_account_id)
-> no call to slack-oauth callback
-> no DB upsert for slack
-> preview polling never finds connected row
-> user sees persistent failure/blocked state
```

Observed patterns/anomalies
- Pattern: repeated `initiate`, zero callback invocations.
- Pattern: zero `slack` rows in `user_integrations`.
- Anomaly: React ref warning in `OAuthConfirmDialog`; unrelated to OAuth failure.
- Cross-origin nuance: flow starts in preview but callback is hard-routed to published domain.

Root cause (certain)
- The published frontend serving `/oauth-complete` is stale/out-of-sync with the current repo logic (or otherwise not deploying the Slack callback branch). Backend is not the blocker.

Initial solution (based on evidence)
1. Redeploy/publish frontend so live `/oauth-complete` includes the Slack branch now present in source.
2. Re-test from published app URL (`/integration/slack`), not preview.
3. Verify success criteria:
   - `slack-oauth` logs include `exchanging code` then `saved for user`.
   - `user_integrations` contains `integration_id='slack', status='connected'`.
   - Slack detail page reflects connected state.
4. Optional hardening after fix: show a notice when Slack connect is started in preview, instructing completion/validation on published URL.
