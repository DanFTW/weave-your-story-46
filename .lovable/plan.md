# Fix: Fireflies Transcript Tracker Not Detecting Transcripts

## Problem Analysis

The `fireflies-automation-triggers` edge function currently only generates webhook credentials on activation. Unlike the Todoist tracker (which fetches all existing items on activate and supports manual polling), the Fireflies tracker has **no sync logic at all** -- it cannot detect any transcripts, old or new, unless Fireflies happens to POST to the webhook URL.

Three gaps identified:

1. **No initial sync on activation** -- Should fetch all existing transcripts from Fireflies and save them as memories (like Todoist does on activate).
2. **No manual sync action** -- No way for the user to trigger a "Check Now" to find new transcripts on demand.
3. **No "Check Now" button in the UI** -- The ActiveMonitoring screen lacks this control (Todoist has it).
4. **Webhook receiver signature mismatch + unsafe fallback** -- The `fireflies-webhook` edge function reads the wrong signature headers (`x-ff-signature` / `x-fireflies-signature`) and allows requests through when the signature header is missing. Fireflies sends `x-hub-signature` and this should be verified when a secret is configured.

## Solution

Add a `syncFirefliesTranscripts` function to the triggers edge function (mirroring `pollTodoistTasks` from Todoist) and wire it into both `activate` and a new `manual-poll` action. Add a "Check Now" button to the ActiveMonitoring UI.

Update the webhook receiver to correctly verify Fireflies signatures and make processing retry-safe by only marking transcripts as processed after a successful memory save (or by deleting the processed row on failure).

The webhook remains as-is for real-time delivery of future transcripts; sync handles the backfill + on-demand check.

---

## Changes

### 1. `supabase/functions/fireflies-automation-triggers/index.ts` (major rewrite)

Add the following to this edge function:

- **LIAM crypto utilities** (copy from the existing webhook function or Todoist triggers -- same `importPrivateKey`, `signRequest`, `toDER` helpers).
- `syncFirefliesTranscripts(supabaseClient, userId, connectionId)` function that:
  1. Calls Composio tool `FIREFLIES_LIST_TRANSCRIPTS` (or equivalent) via `https://backend.composio.dev/api/v3/tools/execute/FIREFLIES_LIST_TRANSCRIPTS` with `connected_account_id` and `arguments: {}`.
  2. Extracts transcript list from the nested Composio response (defensively, like Todoist does).
  3. Bulk-checks `fireflies_processed_transcripts` to find which are already saved.
  4. For each new transcript: formats as memory string, saves via LIAM API, then inserts into `fireflies_processed_transcripts` (or deletes the inserted row on LIAM failure to allow retry).
  5. Updates `fireflies_automation_config` stats (`transcripts_saved` accumulated, `last_received_at`).
  6. Returns `{ newTranscripts, totalSaved }`.
- **Modify** `activate` **action**: after generating webhook credentials, also run `syncFirefliesTranscripts()` (initial backfill). Return both webhook info AND sync results.
- **Add** `manual-poll` **action**: runs `syncFirefliesTranscripts()` and returns results. (Mirrors Todoist's manual-poll.)
- **Resolve Composio connection**: before sync, look up the user's `composio_connection_id` from `user_integrations` where `integration_id = 'fireflies'` and `status = 'connected'`.

### 2. `src/hooks/useFirefliesAutomation.ts`

- Add a `manualSync` function that invokes `fireflies-automation-triggers` with `action: 'manual-poll'`.
- After sync completes, update local `config` state with the returned stats.
- Expose `manualSync` and `isSyncing` from the hook.

### 3. `src/components/flows/fireflies-automation/ActiveMonitoring.tsx`

- Add a "Check Now" button (matching Todoist's pattern) that calls `manualSync`.
- Show a loading state while syncing.

### 4. `src/types/firefliesAutomation.ts`

- No structural changes needed -- the existing types already cover `transcriptsSaved` and `lastReceivedAt`.

### 5. `supabase/functions/fireflies-webhook/index.ts`

- Read Fireflies signature from `x-hub-signature`.
- Require signature verification when `webhook_secret` is present; if missing/invalid, return 401.
- Make processing retry-safe by only inserting into `fireflies_processed_transcripts` after LIAM memory save succeeds (or delete the processed row if LIAM save fails).

---

## Technical Detail: Composio Tool Slug

The Composio tool for listing transcripts is likely `FIREFLIES_LIST_TRANSCRIPTS`. If that slug returns a 404, fall back to direct GraphQL via the user's API key (available from their Composio connection params):

```text
POST https://api.fireflies.ai/graphql
Authorization: Bearer {api_key}
Body: { "query": "{ transcripts { id title date duration participants organizer_email summary { overview } } }" }

```

The edge function should try the Composio tool first, then fall back to direct GraphQL if the tool is not found.

---

## Files Modified (Summary)


| File                                                             | Change                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `supabase/functions/fireflies-automation-triggers/index.ts`      | Add sync logic, LIAM crypto, `manual-poll` action, call sync on activate |
| `src/hooks/useFirefliesAutomation.ts`                            | Add `manualSync` + `isSyncing`                                           |
| `src/components/flows/fireflies-automation/ActiveMonitoring.tsx` | Add "Check Now" button                                                   |
| `supabase/functions/fireflies-webhook/index.ts`                  | Fix signature verification + make processing retry-safe                  |


No other files are touched.