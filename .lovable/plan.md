

## Plan: Add Coinbase Auth Config ID to Static Registry

### Problem
The `composio-connect` edge function has `coinbase` in `VALID_TOOLKITS` but **not** in the `AUTH_CONFIGS` map. This means Coinbase connections use dynamic resolution, which may resolve to a different (wrong) auth config. The correct ID is `ac_cxfInPfbylho`.

### Change
**`supabase/functions/composio-connect/index.ts`** — Add one line to the `AUTH_CONFIGS` record:
```typescript
coinbase: "ac_cxfInPfbylho",
```
after line 193 (the `googlesheets` entry), before the closing `};`.

Then redeploy the edge function.

### Files Changed
- `supabase/functions/composio-connect/index.ts` — Add `coinbase: "ac_cxfInPfbylho"` to `AUTH_CONFIGS`

