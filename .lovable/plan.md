

## Plan: Coinbase Trades to Memory Thread

### Overview
Create a new "Coinbase Trades to Memory" thread that connects to Coinbase via Composio, fetches all trades across every trading pair using `COINBASE_LIST_PRODUCTS_TRADES`, paginates through all results, deduplicates against a processed-trades table, and writes each trade as a structured LIAM memory. Follows the exact Todoist automation pattern.

### Files to Create/Modify

**1. Database Migration** -- New table + RLS

```sql
-- Config table
CREATE TABLE public.coinbase_trades_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  trades_tracked integer NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  last_trade_timestamp timestamptz,  -- cursor for incremental fetches
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coinbase_trades_config ENABLE ROW LEVEL SECURITY;
-- Standard user-scoped RLS (select, insert, update)

-- Deduplication table
CREATE TABLE public.coinbase_processed_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coinbase_trade_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, coinbase_trade_id)
);
ALTER TABLE public.coinbase_processed_trades ENABLE ROW LEVEL SECURITY;
-- RLS: select + insert for own rows
```

**2. `src/data/threads.ts`** -- Add thread entry
- New entry with `id: "coinbase-trades"`, `title: "Coinbase Trades to Memory"`, `icon: Zap` (or a coin-like icon), `gradient: "orange"`, `integrations: ["coinbase"]`, `flowMode: "thread"`, `triggerType: "automatic"`.

**3. `src/data/threadConfigs.ts`** -- Add thread config
- Steps: Connect Coinbase (integration), Trade Monitoring toggle (setup), Always-On Monitoring (save/LIVE badge).

**4. `src/data/flowConfigs.ts`** -- Add flow config
- `id: "coinbase-trades"`, `isCoinbaseTradesFlow: true`.

**5. `src/types/flows.ts`** -- Add flag
- `isCoinbaseTradesFlow?: boolean`

**6. `src/types/coinbaseTradesAutomation.ts`** -- Types
- Phase, Config, Stats, UpdatePayload interfaces (mirrors Todoist pattern).

**7. `src/hooks/useCoinbaseTradesAutomation.ts`** -- Hook
- Mirrors `useTodoistAutomation`: loadConfig, updateConfig, activateMonitoring, deactivateMonitoring, manualPoll against `coinbase_trades_config` table and `coinbase-trades-poll` edge function.

**8. `src/components/flows/coinbase-trades/` -- UI components**
- `CoinbaseTradesFlow.tsx` -- Main flow (mirrors TodoistAutomationFlow, uses `useComposio('COINBASE')`)
- `AutomationConfig.tsx` -- Toggle + activate button
- `ActiveMonitoring.tsx` -- Stats, Check Now, Pause
- `ActivatingScreen.tsx` -- Loading spinner
- `index.ts` -- Barrel exports

**9. `src/pages/FlowPage.tsx`** -- Wire up
- Import `CoinbaseTradesFlow`, add `if (config.isCoinbaseTradesFlow) return <CoinbaseTradesFlow />;`

**10. `src/pages/Threads.tsx`** -- Add to `flowEnabledThreads`
- Add `'coinbase-trades'` to the array.

**11. `src/pages/ThreadOverview.tsx`** -- Add to `flowEnabledThreads`
- Add `'coinbase-trades'` to the array.

**12. `supabase/functions/coinbase-trades-poll/index.ts`** -- Edge function

Core logic:
- Auth: Bearer token validation (same as Todoist).
- Actions: `activate`, `deactivate`, `manual-poll`.
- On activate/poll:
  1. Get user's Coinbase `composio_connection_id` from `user_integrations`.
  2. Fetch all trading pairs via `COINBASE_LIST_PRODUCTS` Composio action.
  3. For each product, paginate through `COINBASE_LIST_PRODUCTS_TRADES` until no more results.
  4. On first run (`last_trade_timestamp` is null): full backfill of all trades.
  5. On subsequent runs: only fetch trades newer than `last_trade_timestamp`.
  6. Deduplicate against `coinbase_processed_trades` table (check `coinbase_trade_id`).
  7. For each new trade, write to LIAM via the existing crypto utilities (same as Todoist's `createMemory`).
  8. Insert processed trade IDs, update `coinbase_trades_config` stats.
- Memory format:
  ```
  Coinbase Trade
  
  Pair: BTC-USD
  Side: buy
  Size: 0.005 BTC
  Price: $67,432.10
  Time: 2026-03-06T12:34:56Z
  Trade ID: 12345678
  
  A trade was executed on Coinbase.
  ```
- Rate limiting: 500ms delay every 10 memory writes (same as Todoist).

**13. `supabase/config.toml`** -- Add entry
```toml
[functions.coinbase-trades-poll]
verify_jwt = false
```

### Key Decisions
- Reuses the exact same patterns as Todoist: hook structure, UI components, edge function auth, LIAM crypto signing, dedup table, Composio tool execution.
- First activation does a full historical backfill; subsequent polls use `last_trade_timestamp` as a cursor.
- Pagination handled by looping through Composio action responses until empty.
- `COINBASE_LIST_PRODUCTS` fetches all trading pairs dynamically rather than hardcoding.

