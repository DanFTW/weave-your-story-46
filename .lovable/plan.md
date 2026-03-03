

## Fix: Birthday Reminder Error Surfacing + Free-Text Date Parsing

Two targeted changes in `supabase/functions/birthday-reminder/index.ts`.

### 1. Surface `createDraftViaComposio` failures clearly

The current code returns a `DraftResult` with `success: false` but the caller in `processUser` (line 608) only logs at `error` level. The issue is that errors from Composio aren't thrown, so they can appear "silent" in some flows.

**Changes:**
- In `createDraftViaComposio` (lines 385-449): add detailed logging of the full raw response text on every non-success path (currently only partial/truncated logging).
- In `processUser` (lines 578-610): after a failed `draftResult`, log the full `providerResponse` object so the exact Composio error is always visible. Throw an explicit error when a draft fails during `manual-poll` so the user gets feedback rather than a silent `draftsCreated: 0`.

### 2. Parse dates from free-text memories

The current parser fails on strings like `"Remember Sadie Fernandez's birthday a week before on 20251202"` because none of the compact patterns match — they all require "birthday" to appear immediately before the YYYYMMDD date, but here there's intervening text ("a week before on").

**Changes to `parseBirthdayFromMemory` (lines 113-193):**
- Add a new **free-text fallback** section after the existing compact patterns block (before the final `return null`).
- This fallback uses a two-step approach:
  1. Extract a person name from the text using existing birthday-keyword patterns (e.g., `(.+?)'s birthday` or `birthday of (.+?)`)
  2. Find any YYYYMMDD / YYYY-MM-DD numeric date anywhere in the remaining text
- If both a name and a valid date are found, return the parsed birthday.
- This catches strings where the date is separated from the keyword by arbitrary words like "a week before on".

### Files modified
- `supabase/functions/birthday-reminder/index.ts` only

### No other changes
No UI, hook, type, or migration changes.

