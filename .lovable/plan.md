
Initial findings

- The UI is not the problem. Auto/manual refresh is firing correctly; the session replay and network logs show repeated `action: "prefill"` requests.
- The empty result is coming from `supabase/functions/weekly-event-finder/index.ts`.
- `fetchLiamMemories()` currently makes a direct LIAM `/memory/list` call using project-level env vars (`LIAM_API_KEY`, `LIAM_USER_KEY`), with no request signature and very loose response parsing.
- That bypasses the working per-user LIAM integration already implemented in `supabase/functions/liam-memory/index.ts`, which is what the rest of the app uses for real user memories.
- So the prefill path is effectively querying the wrong memory identity and failing silently, which matches the logs: `prefill` keeps returning `{"interests":"","location":""}` even after LIAM memory creation succeeds.

What to build

1. Fix the prefill backend so it reads the signed-in user’s LIAM memories through the existing `liam-memory` proxy.
2. Extract interests/location from the real LIAM list response instead of the current broken direct call.
3. Expand extraction so it can pick up interests from:
   - explicit `INTEREST/HOBBY` memories
   - event-finder-generated phrases like `My interests and hobbies include: ...`
   - broader user-authored memories (quick memories, other threads) when they contain preference language like “I love”, “I enjoy”, “I’m into”
4. Add proper logging so prefill failures are visible instead of quietly returning empty strings.
5. Keep the existing additive chip merge behavior in the UI.

Implementation plan

- `supabase/functions/weekly-event-finder/index.ts`
  - Replace the current direct LIAM list request inside `fetchLiamMemories()`.
  - Reuse the existing LIAM integration path by making an internal call to `liam-memory` for the current user.
  - Add small pure helpers inside the function file for:
    - listing user LIAM memories
    - extracting interest candidates
    - extracting location candidates
    - normalizing/deduplicating tags
  - Parse the same response shape already handled successfully elsewhere (`data.data.memories` with safe fallbacks).
  - Prefer tag-aware matches first (`INTEREST/HOBBY`, `LOCATION`, related lifestyle/personal tags), then apply conservative text-pattern extraction for broader memories.

- Frontend
  - Leave `EventFinderConfig.tsx` largely unchanged; the additive refresh/merge logic already looks correct.
  - Keep `useWeeklyEventFinder.ts` stable unless we decide to surface richer prefill error states.

- Observability
  - Log LIAM list failures with status and summarized response body.
  - Avoid swallowing backend errors without a trace.

Technical note

- This is primarily a backend retrieval bug, not a chip UI bug.
- The biggest root cause is that weekly-event-finder is bypassing the app’s proven per-user LIAM proxy and using global LIAM env vars instead.
- After that fix, if there are still gaps for hybrid/local-only sources, the next phase would be to supplement from local source tables to mirror the way the Memories page merges LIAM + local data.

Files likely to change

- `supabase/functions/weekly-event-finder/index.ts`
- Possibly a very small follow-up in `src/hooks/useWeeklyEventFinder.ts` if we improve prefill error handling
