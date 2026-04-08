
Goal

- Ensure every variant of the “interests and hobbies include” prefix normalizes to the same clean tag before it reaches UI state or gets rendered.

What I found

- `src/utils/interestTagUtils.ts` currently strips:
  - `my interests and hobbies include`
  - `interests include`
  - `hobbies include`
- It does not strip the dirty variants now showing in the UI, such as:
  - `Interests And Hobbies Include Web`
  - `Interests And Hobbies Include: Tech`
- The edge function has the same gap:
  - `STRIP_PREFIXES` is too narrow
  - `parseInterestStatement` only recognizes the `my ...` form
- One raw client entry path still bypasses normalization entirely:
  - manual tag add in `EventFinderConfig.tsx`

Implementation

1. Broaden the canonical prefix matcher in `src/utils/interestTagUtils.ts`
   - Replace the narrow prefix rules with one broader anchored family that covers:
     - `My interests and hobbies include`
     - `Interests and hobbies include`
     - `Interests and hobbies include:`
     - `Interests include`
     - `Hobbies include`
   - Keep optional `my`, optional colon, and flexible whitespace.

2. Mirror that exact prefix family in `supabase/functions/weekly-event-finder/index.ts`
   - Update `STRIP_PREFIXES` so prefill strips these variants at the source.
   - Broaden `parseInterestStatement` so values like `Interests and hobbies include: web, tech` split into separate tags instead of leaking a long dirty string.

3. Close the last raw client path in `EventFinderConfig.tsx`
   - Run manually added tags through `cleanInterestTag` before adding them to local state or syncing them back to memory.
   - Ignore empty results and dedupe against existing normalized tags.

4. Keep the already-correct consumer paths
   - Continue using `parseAndDeduplicateInterestTags` for:
     - initial config hydration
     - refresh-from-memories merge
     - active-view rendering
     - active sync merge
   - This preserves defense-in-depth and immediately cleans legacy stored values on display.

Files to update

- `src/utils/interestTagUtils.ts`
- `src/components/flows/weekly-event-finder/EventFinderConfig.tsx`
- `supabase/functions/weekly-event-finder/index.ts`

Verification

- All of these should render as only `Tech`:
  - `My interests and hobbies include: tech`
  - `Interests and hobbies include tech`
  - `Interests and hobbies include: tech`
  - `Interests include tech`
- `Interests and hobbies include: web, tech` should become two tags: `Web`, `Tech`
- `Making Music` should still appear only once when it exists in saved config, prefill data, or manual input

Technical details

- Use one regex shape in both client and edge-function code, for example:
  - `^(?:my\s+)?(?:interests?(?:\s+and\s+hobbies?)?|hobbies?)\s+include\s*:?\s*`
- Preserve the existing:
  - 60-character cap
  - whitespace collapse
  - title-casing
  - case-insensitive deduplication
- Do not change unrelated UI, delivery, or thread logic.
