

## Root Cause

The `isBirthdayInDays` function is correct (starts at `d = 0`, includes today). The real issue is **the regex parser silently drops memories it can't match**. The logs confirm: 15 birthday memories are fetched, but only Donald Duck and Friendo (March 8) ever appear as "Upcoming birthday" — the March 2 birthday memory is parsed as `null` and skipped at line 378.

The 4 regex patterns are brittle and only match specific sentence structures like:
- `"X's birthday is March 2"`
- `"Birthday of X is March 2"`
- `"X birthday March 2"`
- `"March 2 is X's birthday"`

Any variation (colon separators, "has a birthday on", "born on", etc.) silently fails.

## Plan

### Step 1: Add debug logging for unparsed memories

In `processUser` (around line 375-378), log the raw memory text when `parseBirthdayFromMemory` returns null. This surfaces exactly what text format is failing so we can add the right pattern.

```typescript
if (!parsed) {
  console.log(`[Birthday] Could not parse birthday from: "${memText.substring(0, 120)}"`);
  continue;
}
```

### Step 2: Expand regex patterns to cover common variations

Add patterns for:
- `"X's birthday: Month Day"` (colon separator)
- `"X was born on Month Day"` / `"X born Month Day"`
- `"X's birthday is on Month Day, Year"` (trailing year)
- `"X has a birthday on Month Day"`
- Numeric date formats like `"X's birthday is 3/2"` or `"03/02"`

### Files changed
- `supabase/functions/birthday-reminder/index.ts` — add debug logging for unparsed memories and expand regex patterns
- Redeploy edge function

### Verification
After deploying, click **Check Now** on `/flow/birthday-reminder`. The logs will either show the March 2 birthday being detected and processed, or show the exact memory text that still fails to parse — letting us iterate precisely.

