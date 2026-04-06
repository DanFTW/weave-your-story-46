
Preliminary investigation summary

What I found
- The Google Sheets auth config is correct in both places:
  - `supabase/functions/composio-connect/index.ts` pins `googlesheets` to `ac_P0DYB0XdGLn3`
  - `supabase/functions/email-receipt-sheet/index.ts` validates against `ac_P0DYB0XdGLn3`
- The live edge-function log confirms the stored Sheets connection is using that same config, but it is expired:
  - `Connection ca_E2w8GO_fjo9Q: auth_config=ac_P0DYB0XdGLn3, status=EXPIRED`
- The `user_integrations` row is still pointing to that same old connection ID, with an old March timestamp and `status=connected`. No newer `ca_...` ID has replaced it.
- In the captured session replay, the reconnect button was not clicked before the report, so there is no disconnect evidence in that snapshot. But the stale DB row shows that no successful reconnect has been persisted yet.
- There is also a deployment mismatch: the checked-in `email-receipt-sheet` function now returns a JSON reconnect response without setting `401`, but the live network trace is still receiving `401`. So the running edge function does not fully match the current file.

Root cause
- This is not an auth-config mismatch.
- The real issue is that the stale expired Google Sheets connection is never getting replaced in `user_integrations`, so the flow keeps reusing `ca_E2w8GO_fjo9Q`.
- The reconnect workflow is brittle:
  1. `EmailReceiptSheetFlow` calls `disconnectSheets()` and then navigates to `/integration/googlesheets`
  2. `disconnect()` swallows failures, so navigation still happens even if the stale row was not removed
  3. `IntegrationDetail` auto-redirects back to the flow whenever `returnAfterGooglesheetsConnect` exists and the integration still looks `connected`
  4. Since the stale row still says `connected`, the user can be sent right back without ever starting a fresh OAuth flow
- That explains why reconnecting appears to do nothing and why the same expired connection keeps triggering the error.

Initial solution I’d recommend
1. First make sure the live `email-receipt-sheet` deployment matches the current repo behavior, so testing is not distorted by an older `401` response.
2. Make the reconnect path atomic from the thread itself:
   - start Google Sheets OAuth directly from `/flow/email-receipt-sheet`
   - use a forced reauth path
   - do not rely on routing through `IntegrationDetail` as the main recovery path
3. Keep disconnect as best-effort, but do not let a silent disconnect failure send the user into a stale auto-return loop.
4. Treat reconnect as successful only after a new `composio_connection_id` or a fresh connection transition is present in `user_integrations`.

Technical details
- Files most directly involved:
  - `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`
  - `src/hooks/useComposio.ts`
  - `src/pages/IntegrationDetail.tsx`
  - `supabase/functions/email-receipt-sheet/index.ts`
- The existing auth-config checks in the edge function are good and should stay.
- The main thing to fix is connection replacement and reconnect control flow, not the auth config ID itself.
