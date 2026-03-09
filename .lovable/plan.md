## Plan: Extract pure functions into `src/utils/calendarThread.ts` + create `tests/calendarThread.test.ts`

### New file 1: `src/utils/calendarThread.ts`

Four pure, testable functions extracted from the edge function logic:

**1. `detectEventReference(content: string): boolean**`

- Regex-based heuristic that checks if a memory string likely contains an event/date reference
- Patterns: named dates ("Monday", "January 5th"), ordinal dates ("the 3rd"), relative dates ("tomorrow", "next week", "in 2 days"), ISO-ish dates ("2025-03-10"), time patterns ("at 3pm", "at 14:00"), event keywords near date-like tokens ("meeting", "appointment", "deadline", "party", "dinner")
- Returns `false` for generic statements with no temporal event signal

**2. `parseEventTitle(content: string): string | null**`

- Extracts a likely event title from memory text
- Heuristic: takes the first sentence/clause, strips date/time references, trims to a reasonable length
- Returns `null` if nothing meaningful remains

**3. `buildComposioPayload(params: { connectionId: string; title: string; date: string; time: string | null; description: string | null; timezone?: string }): ComposioCalendarPayload**`

- Pure function that builds the Composio `GOOGLECALENDAR_CREATE_EVENT` payload object
- Handles default 60-minute duration, default 09:00 start when time is null, default timezone "America/New_York"
- Returns the shaped object (no fetch, no side effects)
- Type: `{ connected_account_id: string; arguments: { summary; start_datetime; end_datetime; description; timezone } }`

**4. `sanitizeMemoryContent(content: string): string**`

- Strips HTML tags, collapses whitespace, trims, truncates to a max length (e.g., 2000 chars)
- Pure string transform

### New file 2: `tests/calendarThread.test.ts`

Unit tests using Vitest (already configured via Vite). Test groups:

`**detectEventReference**`

- Named dates: "Meeting on Monday at 3pm" → `true`
- Ordinal dates: "Dentist on the 15th" → `true`  
- Relative dates: "Call mom tomorrow" → `true`
- Negative: "I like pizza" → `false`
- Negative: "The year 2025 was great" → `false`

`**buildComposioPayload**`

- Correct shape: has `connected_account_id` and `arguments` with all fields
- Default 60min duration: time "14:00" → end "15:00"
- Null time → default 09:00–10:00
- Null description → empty string in payload
- Null guards: throws or returns sensible defaults for missing required fields

`**sanitizeMemoryContent**`

- Strips HTML, collapses whitespace, trims

`**parseEventTitle**`

- Extracts title from event-like text
- Returns null for empty/whitespace

### What stays unchanged

- No changes to the edge function, `MemoryCard.tsx`, `tagConfig.ts`, or any other existing file
- The edge function can later import or inline these utils if desired; for now they're standalone testable modules  
  
Also add a null guard test for `buildComposioPayload` when `connectionId` is missing or empty.
- &nbsp;