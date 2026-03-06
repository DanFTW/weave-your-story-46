
Investigation complete (no code changes made).

1) What I traced
- UI source: `/integration/coinbase` reads `user_integrations.account_name/account_email/account_avatar_url` via `useComposio.checkStatus()` and renders `IntegrationConnectedAccount`.
- Backend source: those fields are written only by `supabase/functions/composio-callback/index.ts` during OAuth completion.
- Runtime evidence:
  - DB row is saved as `status='connected'` but `account_name/email/avatar = null`.
  - Edge logs show: `ReferenceError: composioApiKey is not defined` in Coinbase block.
  - Same logs show Coinbase auth config is `auth_scheme: API_KEY` with payload keys like `generic_api_key/generic_secret`, not an OAuth `access_token`.

2) Root cause (combined)
- Code defect: Coinbase fallback fetch uses `composioApiKey` (undefined) instead of `COMPOSIO_API_KEY`, so fallback account-fetch logic throws.
- Workflow mismatch: Coinbase connection is currently API-key based, but callback logic is primarily OAuth-token based (`Bearer access_token` for `/v2/user`). With API_KEY auth, no access token is present, so profile enrichment never runs successfully.
- Result: integration record is created, but profile fields remain null, so UI shows generic “Connected Account” with no email/avatar.

3) Why this persisted after prior fix
- Prior changes improved token lookup paths, but the active Coinbase connection payload does not include OAuth tokens.
- Even before that, the undefined variable prevented the fallback call path from working.

4) Initial solution (recommended)
- Step A (bug fix): correct `composioApiKey` -> `COMPOSIO_API_KEY` in Coinbase branch.
- Step B (auth-aware profile strategy):
  - If OAuth token exists: keep `/v2/user` bearer flow.
  - If `auth_scheme === API_KEY`: fetch identity using API-key-compatible path (Composio-executed profile tool or connection-provided request metadata), instead of assuming bearer token.
- Step C (connect-time guard): in `composio-connect`, prefer OAuth auth configs for Coinbase when profile fields are required.
- Step D: reconnect Coinbase once after deploy to repopulate `user_integrations` profile fields.

5) Secondary note (not root cause)
- Console ref warnings in `IntegrationDetail` (`IntegrationCapabilityTag`, `IntegrationDoneButton`) are separate UI issues and do not cause Coinbase profile nulls.
