# Fix: Google Drive Document Tracker -- Consistent, Full-Text Memories

## Problems Identified

1. **Fragmented memories**: Each document metadata field (title, link, date) is being saved as a separate memory instead of one consolidated memory per document
2. **No actual document content**: The `GOOGLEDRIVE_DOWNLOAD_FILE` response data isn't being extracted correctly -- memories only contain metadata like "Document Link: ..." and "Document Created on: ..."
3. **Content too short**: The 2000-char limit truncates documents unnecessarily (Fireflies uses 8000)
4. **No debug logging** on the export response, making it impossible to diagnose content extraction issues
5. **“Random” documents being saved**: Activation/backfill or trigger delivery is causing existing/older docs (not strictly “newly created while monitoring is ON”) to be saved as memories.

## Root Cause

The `exportDocContent` function tries several nested paths (`data.response_data`, `data.content`, `data`) but likely gets an object back (not a string), which then gets coerced to `[object Object]` or empty. The `formatDocAsMemory` function then creates a multi-line string with only metadata, **and the current code path is likely creating multiple LIAM memories per document (one per metadata field) instead of a single consolidated LIAM create call per document.** Additionally, the triggers path may be running an initial backfill/manual poll on activation (or the chosen trigger returns existing matches), which makes the saved documents appear “random” rather than only new docs created while monitoring is enabled.

## Changes

### 1. Fix `supabase/functions/googledrive-automation-triggers/index.ts`

`exportDocContent` **function** (lines 121-151):

- Add logging of the raw Composio response to diagnose what shape the data comes in
- Walk deeper into nested response objects to find the actual text string
- If `data` is an object, try `JSON.stringify` as last resort rather than returning empty
- If Composio returns base64/bytes fields (common for “download/export”), decode to UTF-8 string before falling back to `JSON.stringify`

`formatDocAsMemory` **function** (lines 98-117):

- Build a single consolidated memory block with header + full content (not "Content Preview:")
- Increase content limit from 2000 to 8000 chars (matching Fireflies pattern)
- Ensure the entire memory is one coherent block -- title, metadata, and content together
- Ensure the LIAM create call happens **exactly once per document** (no per-field/per-line memory creation)

**Trigger/backfill behavior** (same file, in the `activate` path):

- Remove any “runs initial poll/backfill” behavior from `activate` so activation does **not** save existing docs automatically
- Keep any polling/backfill strictly behind the user-initiated “Check Now” action only

### 2. Fix `supabase/functions/googledrive-automation-webhook/index.ts`

Same fixes as above -- this file has its own copies of `exportDocContent` and `formatDocAsMemory`:

- Fix `exportDocContent` (lines 96-125): Add logging, improve content extraction
- Fix `formatDocAsMemory` (lines 129-147): Consolidated format, 8000-char limit
- Ensure the webhook handler creates **exactly one** LIAM memory per document (single call per fileId)
- Ensure the webhook handler respects the monitoring toggle: if `googledrive_automation_config.is_active = false`, ignore the event (do nothing)

### 3. Both files -- Content extraction improvement

Replace the current extraction chain:

```
data?.data?.response_data || data?.data?.content || data?.data || ""

```

With a robust extractor that:

- Logs the raw response shape for debugging
- Checks `data.data.response_data` (string case)
- Checks `data.data.response_data.content` (nested object case)
- Checks `data.data.content`
- Checks common base64/bytes fields and decodes to UTF-8 text when present
- If result is an object, stringify it
- Trims and validates the result is non-empty

### 4. Both files -- Memory format change

Current (fragmented):

```
Document: Title
Type: application/vnd.google-apps.document
Created: 8/11/2025
Link: https://docs.google.com/...

Content Preview:
(truncated at 2000 chars)

```

New (consolidated, single memory):

```
Google Drive Document: [Title]
Created: [Date] | Link: [URL]

[Full document text up to 8000 chars]

```

### 5. Both files -- Dedupe + retry safety

- Only insert into `googledrive_processed_documents` **after** the LIAM memory save succeeds
- If the insert conflicts on the unique constraint, treat it as already-processed (safe no-op)

## Files Modified


| File                                                          | Change                                                                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/googledrive-automation-triggers/index.ts` | Fix `exportDocContent` extraction + logging, fix `formatDocAsMemory` to be consolidated with 8000-char limit, ensure 1 LIAM call per doc, remove activation backfill/poll behavior |
| `supabase/functions/googledrive-automation-webhook/index.ts`  | Same fixes for its copies of both functions, ensure webhook respects `is_active`, ensure 1 LIAM call per doc, retry-safe dedupe                                                    |


## No Other Changes

No UI, data, type, or config changes needed -- this is purely a backend content extraction and formatting fix **plus the minimal trigger/webhook handling adjustments required to ensure only new docs are saved when monitoring is ON and each doc produces exactly one full-text memory.**