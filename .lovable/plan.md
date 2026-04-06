
Goal: stop the repeating 401 loop in `/flow/email-receipt-sheet` by ensuring Google Sheets reconnections use the intended auth config and actually replace the stale expired connection.

Findings:
- `supabase/functions/composio-connect/index.ts` already pins `googlesheets` to `ac_P0DYB0XdGLn3` in `AUTH_CONFIGS`.
- `supabase/functions/email-receipt-sheet/index.ts` does not pass any auth config ID during `GOOGLESHEETS_*` tool execution. It only passes `connected_account_id`, which means the active auth config is whatever was used when that connected account was created.
- So the edge function is not “using a different auth config” directly; the real risk is that the stored Google Sheets connected account was created under the wrong config, or the reconnect flow never replaced the stale one.
- In `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`, the `"needs-reconnect"` button only navigates to `/integration/googlesheets`. Unlike the existing Instagram/Slack reconnect patterns, it does not disconnect first. That can leave the expired `user_integrations.composio_connection_id` in place, which explains why the 401 can keep repeating.
- `composio-connect` also has an `Auth_Config_NotFound` fallback that can retry with a dynamically discovered auth config. For Google Sheets, that is risky because it can silently create a new connection under a different config.

Implementation plan:
1. Tighten Google Sheets auth config handling in `supabase/functions/composio-connect/index.ts`
   - Keep `AUTH_CONFIGS.googlesheets = "ac_P0DYB0XdGLn3"`.
   - Make Google Sheets strict: if the configured auth config is missing or rejected with `Auth_Config_NotFound`, return a clear error instead of silently falling back to another auth config.
   - This guarantees new Google Sheets connections for this feature cannot drift to a different config.

2. Validate the stored Google Sheets connected account inside `supabase/functions/email-receipt-sheet/index.ts`
   - Add a small helper that fetches `GET /api/v3/connected_accounts/{connectionId}` from Composio before Google Sheets actions.
   - Read the connected account metadata defensively and verify it belongs to Google Sheets and is associated with `ac_P0DYB0XdGLn3`.
   - Run this validation before `list-spreadsheets`, `create-spreadsheet`, and `manual-sync`.
   - If the stored account uses a different/missing auth config, return:
     - `401`
     - `{ needsReconnect: true, error: "Google Sheets connection is using the wrong authentication configuration. Please reconnect." }`
   - This is the correct place to enforce auth-config correctness, since tool execution itself only accepts `connected_account_id`.

3. Fix the reconnect flow in `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`
   - Destructure `disconnect` from `useComposio("GOOGLESHEETS")`.
   - Update the `"Reconnect Google Sheets"` button to:
     1. disconnect the current Google Sheets integration,
     2. store `returnAfterGooglesheetsConnect`,
     3. navigate to `/integration/googlesheets`.
   - This matches the project’s existing reconnect pattern and ensures the next OAuth flow creates and saves a fresh connection ID.

Why this fixes the issue:
- It prevents `composio-connect` from silently creating Google Sheets connections under the wrong auth config.
- It makes `email-receipt-sheet` explicitly reject mismatched/stale Google Sheets connected accounts instead of repeatedly trying them.
- It makes the reconnect CTA actually perform a real reconnect instead of just opening the integration page while the expired connection remains active.

Scope:
- Only these files:
  - `supabase/functions/composio-connect/index.ts`
  - `supabase/functions/email-receipt-sheet/index.ts`
  - `src/components/flows/email-receipt-sheet/EmailReceiptSheetFlow.tsx`
- No database changes.
- No unrelated integration/UI changes.

Technical note:
- The key nuance is that `email-receipt-sheet` cannot force an auth config during `GOOGLESHEETS_*` execution. The auth config is implicit in the stored Composio connected account. So the best-practice fix is:
  - create Google Sheets connections with the pinned config,
  - validate the stored connected account before use,
  - and ensure reconnect actually replaces the old account.
