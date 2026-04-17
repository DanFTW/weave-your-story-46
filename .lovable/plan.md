
User wants live Composio API testing against Coinbase auth config `ac_8qxtj5vBqSnf` with three specific slugs, then a rebuild estimate. This is research — no production code changes. But it does require running live API calls, which needs `code--exec` (default mode capability).

Plan:
1. Read existing Coinbase code (`coinbase-trades-poll/index.ts`) to find the right user/connection ID under `ac_8qxtj5vBqSnf` and reuse the Composio v3 execute pattern.
2. Query DB for an active connected account under that auth config to get a `connectionId`.
3. Once approved, run three live Composio v3 tool executions via `code--exec` against `https://backend.composio.dev/api/v3/tools/execute/{slug}` with `COMPOSIO_API_KEY` and the connection ID for: `COINBASE_LIST_WALLETS`, `COINBASE_LIST_ASSETS`, `COINBASE_GET_SUPPORTED_NETWORKS`.
4. Capture exact response shape, success flag, real-data check for each.
5. Synthesize rebuild scope + honest hour estimate based on what those calls actually return.

No production file edits. Output is a research report.

## Steps once approved
1. `code--view supabase/functions/coinbase-trades-poll/index.ts` — confirm exact execute payload shape and headers
2. `supabase--read_query` — find one connected account under `ac_8qxtj5vBqSnf` (composio_connection_id from `user_integrations` where toolkit_slug='coinbase')
3. Three parallel `code--exec curl` calls to `https://backend.composio.dev/api/v3/tools/execute/{SLUG}` with `x-api-key: $COMPOSIO_API_KEY`, body `{"connected_account_id": "...", "arguments": {}}`
4. For each, record: HTTP status, `successful` flag, `data` shape, error if any
5. Write final report with:
   - Per-slug results table (auth success, response shape, real data y/n)
   - Rebuild scope: replace `coinbase-trades-poll` with `coinbase-wallets-grab` + `coinbase-wallets-watch`, new tables, new UI flow components, cron entry
   - Honest hour breakdown by component
   - Risk callouts (Composio coverage gaps surfaced by the live test)

## Output
Single markdown report, ~250-400 lines. No code changes to `src/` or production edge functions. May write a throwaway test script to `/tmp/` only.
