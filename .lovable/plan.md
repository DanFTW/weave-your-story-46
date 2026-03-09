

## Analysis

The existing code already handles most of what's requested:
- `EVENT_KEYWORDS` already includes: `dentist`, `doctor`, `appointment`, `checkup`, `check-up`, `interview`
- The test for "Dentist on the 15th" already exists and should pass
- `ORDINAL_DATE` is part of `ANY_DATE_SIGNAL`

However, there are two small gaps:

1. **Missing keywords**: `vet` and `therapy` are not in the `EVENT_KEYWORDS` regex
2. **Ordinal dates alone aren't a strong signal**: "the 15th" without a keyword match won't trigger detection — making ordinal dates a standalone strong signal (like month names and ISO dates already are) would be a reasonable improvement

## Changes

### File 1: `src/utils/calendarThread.ts`

**A.** Add `vet` and `therapy` to the `EVENT_KEYWORDS` regex (line 53).

**B.** Add ordinal date as a standalone strong signal in `detectEventReference` (after the month-names check around line 108):
```typescript
// Ordinal date ("the 15th") is strong enough on its own
if (ORDINAL_DATE.test(trimmed)) return true;
```

### File 2: `tests/calendarThread.test.ts`

No structural changes needed — the test for "Dentist on the 15th" already exists at line 23. Add one additional test to confirm ordinal dates work **without** a keyword (to verify the standalone signal change):

```typescript
it("detects 'Something on the 22nd' (ordinal alone)", () => {
  expect(detectEventReference("Something on the 22nd")).toBe(true);
});
```

Both files, minimal edits, no other files touched.

