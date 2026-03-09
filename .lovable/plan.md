

# Coinbase Trades Thread — Status and Issues

## Issue 1: Missing tag on memory creation (confirmed, same bug as Instagram analytics)

**Where:** `supabase/functions/coinbase-trades-poll/index.ts`, line 68

```typescript
const body = { userKey: apiKeys.user_key, content };  // no tag
```

The LIAM API receives no `tag`, so memories default to `quick_note`. The flow config already defines `memoryTag: "COINBASE"` but the edge function never uses it.

**Fix:** Add `tag: "COINBASE"` to the body on line 68:
```typescript
const body = { userKey: apiKeys.user_key, content, tag: "COINBASE" };
```

---

## Issue 2: Wrong Composio action — fetching public market trades, not user's fills (critical)

**Where:** `supabase/functions/coinbase-trades-poll/index.ts`, line 230

```typescript
const tradesResult = await executeComposioAction("COINBASE_LIST_PRODUCTS_TRADES", connectionId, input);
```

`COINBASE_LIST_PRODUCTS_TRADES` returns **public market trades** for a product (all trades on the exchange), not the authenticated user's executed orders/fills. This means:
- It would import thousands of irrelevant trades from the public order book
- It has nothing to do with the user's personal trading activity

The project memory note explicitly states the design decision: use the **Composio Proxy endpoint** (`POST /api/v3/tools/execute/proxy`) to call the Coinbase Advanced Trade **List Fills** API (`GET /api/v3/brokerage/orders/historical/fills`), which returns only the user's executed fills.

**Fix:** Replace the `executeComposioAction("COINBASE_LIST_PRODUCTS_TRADES", ...)` call with a Composio Proxy call to the List Fills endpoint. This also eliminates the need for the hardcoded `productsToScan` array, since List Fills returns fills across all products. The proxy call would look like:

```typescript
const response = await fetch("https://backend.composio.dev/api/v3/tools/execute/proxy", {
  method: "POST",
  headers: {
    "x-api-key": COMPOSIO_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    connectedAccountId: connectionId,
    endpoint: "api/v3/brokerage/orders/historical/fills",
    method: "GET",
    parameters: [
      { name: "limit", in: "query", value: "100" },
      // cursor param for pagination
    ],
  }),
});
```

This simplifies the polling logic significantly — one paginated call instead of iterating 14 trading pairs.

---

## Issue 3: No edge function invocation logs exist

No logs found for `coinbase-trades-poll`, which means either nobody has successfully activated the thread yet, or there's been a connection issue preventing invocation. This is expected if users hit the Coinbase connection flow and it fails before reaching the poll step.

---

## Proposed Fix — Two changes, one file

**File:** `supabase/functions/coinbase-trades-poll/index.ts`

1. **Add `tag: "COINBASE"` to the `createMemory` body** (line 68)
2. **Replace the `pollCoinbaseTrades` function** to use the Composio Proxy → List Fills API instead of iterating `COINBASE_LIST_PRODUCTS_TRADES` across hardcoded pairs. This includes:
   - Single paginated call to List Fills via Composio Proxy
   - Parse fills (which include `product_id`, `side`, `size`, `price`, `commission`, `trade_id`, `created_at`)
   - Update `formatTradeAsMemory` to match the fills response shape
   - Remove the `productsToScan` array
   - Keep existing deduplication and config update logic

3. **Redeploy** `coinbase-trades-poll`

No frontend changes needed — the `CoinbaseTradesFlow` UI, hook, and routing are already correct.

