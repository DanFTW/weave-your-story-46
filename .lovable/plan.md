
Pure diagnostic, no production code changes. Need code--exec for live API calls — that requires default mode. Plan it concisely.

Steps once approved:
1. Query DB: `SELECT composio_connection_id, created_at FROM user_integrations WHERE integration_id='coinbase'` to get all 7 connection IDs under ac_8qxtj5vBqSnf.
2. For each connection ID: GET `https://backend.composio.dev/api/v3/connected_accounts/{id}` to capture auth scheme + credential shape (EC key vs UUID secret vs OAuth token), redacted.
3. Execute COINBASE_LIST_WALLETS against all 7 connections via POST `/api/v3/tools/execute/COINBASE_LIST_WALLETS` with `{"arguments": {}}`. Capture HTTP status, successful flag, error code/message, response_data shape.
4. Argument variations against the best-credentialed connection: `{}`, `null`, `{limit:10}`, `{cursor:""}`, `{page_size:10}`. Compare error deltas.
5. Toolkit catalog scan: GET `/api/v3/toolkits?search=coinbase` and `/api/v3/tools?search=coinbase` (and `?toolkit_slugs=coinbase,coinbase_v2,coinbase_advanced,coinbase_cdp,coinbase_pro,coinbase_commerce`). List every match.
6. Proxy endpoint probe: try `GET /api/v3/connected_accounts/{id}/proxy?endpoint=/v2/accounts`, `POST /api/v3/connected_accounts/{id}/execute`, `/api/v3/proxy/coinbase/v2/accounts` with Connection header. Document which exist (404 vs 200/4xx with body).
7. If any path returns real wallet data → scope a thread build using it. If not → confirm dead end with the matrix of evidence.

Output: ~250-line markdown report saved to `/mnt/documents/coinbase_diagnostic_v3.md` plus chat summary table. No edits to `src/` or `supabase/functions/`.
