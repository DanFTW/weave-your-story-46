

## Fix: Strip Suffix Patterns from Interest Tags

### Problem
Tags like `"Cooking Is One Of My Interests And Hobbies"` pass through prefix stripping unchanged because the conversational phrase is a **suffix**, not a prefix.

### Solution
Add a `CONVERSATIONAL_SUFFIXES` array alongside the existing `CONVERSATIONAL_PREFIXES` in both the client utility and the edge function, then apply them in the cleaning logic.

### Suffix pattern to add
```
/\s+is\s+(?:one\s+of\s+)?(?:my\s+)?(?:interests?(?:\s+and\s+hobbies?)?|hobbies?)/i
```
This handles: `"X is one of my interests and hobbies"`, `"X is my interest"`, `"X is one of my hobbies"`, etc.

### Files to update

| File | Change |
|---|---|
| `src/utils/interestTagUtils.ts` | Add `CONVERSATIONAL_SUFFIXES` array; apply them in `cleanInterestTag` after prefix stripping |
| `supabase/functions/weekly-event-finder/index.ts` | Add same suffix array to `STRIP_PREFIXES` section; apply in `stripInterestPrefixes` |

### Implementation detail

In `cleanInterestTag` and `stripInterestPrefixes`, after stripping prefixes, iterate over suffixes and strip them:

```typescript
const CONVERSATIONAL_SUFFIXES: RegExp[] = [
  /\s+is\s+(?:one\s+of\s+)?(?:my\s+)?(?:interests?(?:\s+and\s+hobbies?)?|hobbies?)\s*$/i,
];

// Applied after prefix stripping, before punctuation/whitespace cleanup
for (const suffix of CONVERSATIONAL_SUFFIXES) {
  cleaned = cleaned.replace(suffix, "");
}
```

No other files need changes — all consumer paths already use `cleanInterestTag` / `parseAndDeduplicateInterestTags`.

