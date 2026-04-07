
Goal: fix the weekly-event-finder curation 404 by making its LLM call match the project’s existing, working pattern instead of using a different endpoint/provider style.

What I found:
- `supabase/functions/weekly-event-finder/index.ts` is the outlier.
- Its curation code calls:
  - URL: `https://lovable.dev/api/v1/chat`
  - model: `gemini-2.5-flash-preview-05-20`
- Other working edge functions in this project consistently use:
  - URL: `https://ai.gateway.lovable.dev/v1/chat/completions`
  - auth header: `Authorization: Bearer ${LOVABLE_API_KEY}`
  - model: `google/gemini-3-flash-preview`
- Examples already working in this repo:
  - `generate-memories`
  - `generate-tags`
  - `calendar-event-sync`
  - `email-text-alert`
  - `spotify-music-finder`
  - `birthday-reminder`

Why the 404 happens:
- `weekly-event-finder` is using a different, non-matching endpoint than the rest of the codebase.
- The current model name also does not match the repo’s established provider/model format.

Implementation plan:
1. Update `curateEvents` in `supabase/functions/weekly-event-finder/index.ts` to use the same Lovable AI Gateway endpoint as the other working functions:
   - `https://ai.gateway.lovable.dev/v1/chat/completions`

2. Change the request body to the project-standard model:
   - `google/gemini-3-flash-preview`

3. Keep the existing backend-only auth pattern:
   - read `LOVABLE_API_KEY` from env
   - send `Authorization: Bearer ...`
   - keep `Content-Type: application/json`

4. Improve curation output handling to follow existing best practices in this repo:
   - preferred: use tool calling for structured curated results instead of regex-parsing freeform JSON
   - define a tool like `select_events` returning an array of up to 5 curated events with:
     - `title`
     - `date`
     - `description`
     - `reason`
   - parse `message.tool_calls[0].function.arguments`
   - fallback to current top-5 raw events if parsing fails

5. Preserve current resilience behavior:
   - if `LOVABLE_API_KEY` is missing, return the first 5 events
   - if the AI call fails, log status/text and fall back to basic filtering
   - optionally add explicit handling for `429` and `402`, matching the style used elsewhere

Technical details:
- File to change:
  - `supabase/functions/weekly-event-finder/index.ts`

- Exact alignment target from other functions:
```text
fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-3-flash-preview",
    ...
  }),
})
```

- Best-practice improvement:
```text
Use tools + tool_choice for structured event selection
instead of asking for JSON in plain text and regex-parsing it.
```

Expected result:
- The 404 should disappear.
- Weekly event curation will use the same LLM provider/call pattern already proven elsewhere in the project.
- The curation step will become more reliable because structured output parsing will match the established edge-function approach.
