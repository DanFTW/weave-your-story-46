

## Plan: Fix Edge Function to Use Correct Composio Actions

### Problem
The current `coinbase-trades-poll` edge function uses `COINBASE_LIST_WALLETS` (a CDP SDK wallet action) instead of the correct Composio Exchange API tools. The user's screenshot confirms the correct slug is `COINBASE_LIST_PRODUCTS_TRADES`, which requires a `product_id` (e.g., "BTC-USD") and supports `after`, `before`, `limit` pagination params (all INTEGER type).

### Approach
Rewrite the `pollCoinbaseTrades` function in `supabase/functions/coinbase-trades-poll/index.ts` to:

1. **Fetch all trading pairs** via `COINBASE_LIST_EXCHANGE_PRODUCTS` (visible in the screenshot's sidebar as "List Exchange Products"). Extract each `product_id`.
2. **For each product**, call `COINBASE_LIST_PRODUCTS_TRADES` with `{ product_id, limit: 100 }`. Paginate using the `after` param (INTEGER trade ID) until no more results.
3. **Deduplicate** against `coinbase_processed_trades` table using the trade's unique ID.
4. **Format each trade** as a structured LIAM memory with Pair, Side, Size, Price, Time, Trade ID.
5. **Track cursor**: Update `last_trade_timestamp` for incremental fetches on subsequent runs. On first run (no `last_trade_timestamp`), do full backfill. On subsequent runs, stop paginating once we hit trades older than the cursor.
6. Remove the wallet/account snapshot fallback logic entirely.

### Files Changed
- `supabase/functions/coinbase-trades-poll/index.ts` -- Rewrite poll logic to use `COINBASE_LIST_EXCHANGE_PRODUCTS` + `COINBASE_LIST_PRODUCTS_TRADES` with proper pagination and trade formatting. Remove `formatWalletAsMemory` and wallet-related code.

### Trade Memory Format
```
Coinbase Trade

Pair: BTC-USD
Side: buy
Size: 0.005
Price: $67,432.10
Time: 2026-03-06T12:34:56Z
Trade ID: 12345678

A buy trade was executed on Coinbase for BTC-USD.
```

