
Investigation summary (no code changes made):

1) What I checked
- Workflow files: `src/hooks/useComposio.ts`, `src/pages/OAuthComplete.tsx`, `supabase/functions/slack-oauth/index.ts`, `supabase/config.toml`.
- Runtime evidence: edge logs for `slack-oauth`, auth logs, query state, and a direct fetch of `/oauth-complete` on the published URL with Slack-like params.

2) Evidence found
- `slack-oauth` is being called for `action: "initiate"` (multiple recent logs).
- There are no `slack-oauth` callback logs (`action: "callback"` path not reached).
- `user_integrations` currently has no `integration_id='slack'` rows (no successful completion persisted).
- Published `/oauth-complete?code=...&state=slack_...` currently renders **“Connection incomplete”** and shows received `{code,state}` — meaning it is still executing the Composio-style `connected_account_id` path instead of Slack callback handling.
- Current Slack redirect URI is hardcoded to the published domain, so OAuth returns there (not preview).

3) Root cause (high confidence)
Primary: Environment/build mismatch in the callback step.
- Slack OAuth returns to the published app.
- The published `/oauth-complete` behavior is still effectively on the Composio path for that request pattern, so it logs `connectionId=null, toolkit=null` and never calls `slack-oauth` callback.
- Result: polling never sees a connected row, so Slack appears “blocked”/stuck.

Secondary contributor:
- Testing from preview can mask this, because Slack always redirects to published URL.

4) Initial solution to apply next
- Ensure the latest frontend build containing Slack callback handling is active on the **published** domain.
- Validate callback branch on published: when URL has `code` + `state=slack_*`, call `slack-oauth` with `{ action: "callback", code }` before Composio logic.
- Keep Composio branch untouched for other integrations.
- Add one guardrail: if user starts Slack connect from preview, show a clear notice to complete/test Slack on published URL to avoid false failures.

5) Quick verification checklist after rollout
- Connect Slack from `https://weave-your-story-46.lovable.app/integration/slack`.
- Confirm `slack-oauth` logs show both:
  - `initiate for user ...`
  - `exchanging code for token...` then `saved for user ...`
- Confirm `user_integrations` gets a `slack` row with `status='connected'`.
- Confirm `/integrations/slack` shows connected state.
