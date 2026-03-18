

## Plan: Update Coinbase Auth Config and Slugs

### Changes (2 files, both edge functions)

**1. `supabase/functions/composio-connect/index.ts`**
- Update `coinbase` entry in `AUTH_CONFIGS` from `"ac_8qxtj5vBqSnf"` to `"ac_fCVi2K8lFafl"` (line 195)

**2. `supabase/functions/coinbase-trades-poll/index.ts`**
- Replace the proxy-based `fetchFillsViaProxy` function (which calls `api/v3/brokerage/orders/historical/fills` directly) with a Composio tool-based approach using the correct slugs:
  - `COINBASE_LIST_ACCOUNTS` — list wallets
  - `COINBASE_LIST_TRANSACTIONS` — fetch transaction history (replaces the fills endpoint)
- Update `extractFills` to handle the transaction response shape instead of fills
- Update `formatFillAsMemory` to map transaction fields (type, amount, currency, timestamp) instead of fill fields (product_id, side, size, price)
- The function will call `POST https://backend.composio.dev/api/v3/tools/execute/{SLUG}` with `{ connected_account_id, arguments }` instead of the proxy endpoint

### What stays the same
- All deduplication logic, LIAM memory creation, pagination, config updates, and the main handler remain unchanged
- No other files are modified

