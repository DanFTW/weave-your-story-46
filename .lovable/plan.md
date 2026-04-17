
User is calling out that the previous audit was wrong — Composio actually exposes ~28 Coinbase tools. Need to re-run diagnostic correctly.

Plan:
1. Query Composio's tool listing endpoint correctly: `GET https://backend.composio.dev/api/v3/tools?toolkit_slug=coinbase` (or `&toolkits=coinbase`) with `x-api-key` header. Confirm full count + exact slug casing.
2. Live-execute 6 slugs against connection `ca_N6QTt3ZhkatV` under auth config `ac_8qxtj5vBqSnf` via `POST /api/v3/tools/execute/{slug}` with `{connected_account_id, arguments}`.
   - COINBASE_LIST_WALLETS — no args
   - COINBASE_LIST_ASSETS — no args
   - COINBASE_GET_SUPPORTED_NETWORKS — no args
   - COINBASE_LIST_CURRENCIES — no args
   - COINBASE_GET_ASSET_DETAILS — needs asset_id (pull one from LIST_ASSETS result, or try "BTC")
   - COINBASE_LIST_WRAPPED_ASSETS — no args
3. For each: capture HTTP status, `successful` flag, error_code/message, response_data shape (top-level keys, array length).
4. Rebuild estimate based on what actually returned real data.

Requires: code--exec (live curl with COMPOSIO_API_KEY env), and reading existing coinbase-trades-poll/index.ts to mirror exact request shape. No production edits.

Output: ~200-line markdown report with the corrected tool count, per-slug results table, and a revised honest hour estimate that may be lower than the prior 32hr if Composio actually covers wallets cleanly.

Steps once approved:
1. `code--view supabase/functions/coinbase-trades-poll/index.ts` lines 80-115 (confirm execute call shape)
2. Parallel `code--exec`: (a) list tools, (b-g) six execute calls
3. If LIST_ASSETS returns IDs, re-run GET_ASSET_DETAILS with a real asset_id
4. Write report
