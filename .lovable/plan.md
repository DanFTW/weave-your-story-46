

# Wire calendarThread utils into the edge function

## Key Constraint

Supabase edge functions run in **Deno** and cannot import from `src/`. The path `src/utils/calendarThread.ts` is not accessible at runtime from `supabase/functions/calendar-event-sync/index.ts`.

## Proposed Approach

Copy the four pure functions into `supabase/functions/_shared/calendarThread.ts` (the standard Supabase convention for shared edge function code), then import them from the edge function. The `src/utils/calendarThread.ts` remains the canonical tested copy; the `_shared` version is a mirror.

### Changes

**New file: `supabase/functions/_shared/calendarThread.ts`**
- Mirror of `src/utils/calendarThread.ts` — identical logic, Deno-compatible (it already is, no Node APIs used)

**Edit: `supabase/functions/calendar-event-sync/index.ts`**

1. **Import** the four functions from `../_shared/calendarThread.ts`
2. **Replace `createGCalEvent` payload construction** (lines 134-138) with `buildComposioPayload()`:
   - Instead of manually computing `startDate`/`endDate`, call `buildComposioPayload({ connectionId, title, date, time, description })` and use its output in the Composio fetch body
   - The fetch call itself (lines 142-161) stays the same — just swap the inline JSON body with the payload object
3. **Add `sanitizeMemoryContent`** before passing content to `parseMemoryForEvent` — sanitize the raw memory text (strip HTML, collapse whitespace) before AI parsing
4. **No changes** to `parseMemoryForEvent` (AI parsing), the LIAM query, or function signatures — those stay as-is

`detectEventReference` and `parseEventTitle` are not currently used in the edge function (the AI does that work), so they'll be available as imports but won't replace any inline code — there is no inline duplication of those two functions to replace.

### What stays unchanged
- `src/utils/calendarThread.ts` — untouched
- `tests/calendarThread.test.ts` — untouched
- All other files — untouched
- Function signatures, Composio fetch call structure, LIAM query, DER signing — all untouched

