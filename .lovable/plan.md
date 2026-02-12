# Google Drive Document Tracker Thread

## Overview

Create a "Google Drive Document Tracker" thread that uses Composio's **webhook trigger** `GOOGLEDRIVE_NEW_FILE_MATCHING_QUERY_TRIGGER`) to automatically detect new Google Docs and save them as memories. Includes a manual "Check Now" poll fallback. Modeled after the Todoist/Trello automation patterns.

## Architecture

The flow uses a **dual-mode** approach:

1. **Real-time**: Composio webhook trigger fires when a new Google Doc is created, calling our webhook endpoint

2. **Manual fallback**: "Check Now" button polls via Composio `GOOGLEDRIVE_SEARCH_FILE` tool for backfilling

### Two-step user flow:

1. Connect Google Drive (redirect to `/integration/googledrive` if not connected)

2. Toggle Document Monitoring on/off + Activate

## Files to Create (9 new files)

### 1. Type Definition

*`src/types/googleDriveAutomation.ts`**

* `GoogleDriveAutomationPhase`: `'auth-check' | 'configure' | 'activating' | 'active'`

* `GoogleDriveAutomationConfig`: id, userId, isActive, triggerInstanceId, documentsSaved, lastSyncAt

* `GoogleDriveDocStats`: documentsSaved, isActive, lastSyncAt

* Follows `todoistAutomation.ts` pattern exactly

### 2. Custom Hook

*`src/hooks/useGoogleDriveAutomation.ts`**

* Modeled on `useTodoistAutomation.ts`

* Reads/writes `googledrive_automation_config` table

* Calls `googledrive-automation-triggers` edge function for activate/deactivate/manual-poll

* Manages phase state, config loading, stats

### 3. Flow UI Components (4 files)

*`src/components/flows/googledrive-automation/index.ts`** -- Barrel exports

*`src/components/flows/googledrive-automation/GoogleDriveAutomationFlow.tsx`**

* Modeled on `TodoistAutomationFlow.tsx`

* Uses `useComposio('GOOGLEDRIVE')` for auth check

* Blue gradient with `#4285F4` accent color (Google Drive brand)

* `FileText` icon throughout

* Redirects to `/integration/googledrive` if not connected (stores return path in sessionStorage)

*`src/components/flows/googledrive-automation/AutomationConfig.tsx`**

* Single "Document Monitoring" toggle with description

* "Activate Monitoring" button styled with `#4285F4`

* Modeled on Todoist's `AutomationConfig.tsx`

*`src/components/flows/googledrive-automation/ActiveMonitoring.tsx`**

* Green pulse indicator, "Documents Saved" stat counter

* "Check Now" + "Pause" buttons

* Modeled on Todoist's `ActiveMonitoring.tsx`

*`src/components/flows/googledrive-automation/ActivatingScreen.tsx`**

* Loading spinner with `#4285F4` accent, "Setting up monitoring..." text

### 4. Webhook Receiver Edge Function

*`supabase/functions/googledrive-automation-webhook/index.ts`**

* Receives Composio webhook payloads when `GOOGLEDRIVE_NEW_FILE_MATCHING_QUERY_TRIGGER` fires

* Extracts trigger_id from payload, looks up user via `googledrive_automation_config.trigger_instance_id`

* For each new file: checks dedup against `googledrive_processed_documents`, exports doc content via `GOOGLEDRIVE_EXPORT_FILE` Composio tool (text/plain), saves as memory via LIAM API with `GOOGLEDRIVE` tag

* Follows `trello-automation-webhook` pattern (retry-safe: only marks processed after successful memory save)

### 5. Trigger Management Edge Function

*`supabase/functions/googledrive-automation-triggers/index.ts`**

* Three actions: `activate`, `deactivate`, `manual-poll`

* **activate**: Creates `GOOGLEDRIVE_NEW_FILE_MATCHING_QUERY_TRIGGER` via Composio trigger upsert API with `trigger_config: { query: "mimeType='application/vnd.google-apps.document'" }`, sets webhook_url to the webhook function, stores trigger_instance_id in DB, runs initial poll

* **deactivate**: Disables trigger via `PATCH /trigger_instances/manage/{triggerId}`, sets `is_active = false`

* **manual-poll**: Polls via `GOOGLEDRIVE_SEARCH_FILE` Composio tool with mimeType filter, exports new docs via `GOOGLEDRIVE_EXPORT_FILE`, saves as memories

* Auth pattern: Bearer token validation via Supabase auth (same as Todoist/Fireflies)

* LIAM API integration with ECDSA signing (same crypto utilities as other edge functions)

## Files to Edit (6 existing files)

### 6. Thread Registration

*`src/data/threads.ts`**

* Add `googledrive-tracker` entry: `{ id: "googledrive-tracker", title: "Google Drive Document Tracker", description: "Automatically save new documents as memories", icon: FileText, gradient: "blue", type: "automation", triggerType: "automatic", flowMode: "thread" }`

### 7. Thread Config

*`src/data/threadConfigs.ts`**

* Add config with 3 steps: Connect Google Drive (iconUrl: googledrive.svg), Enable Monitoring (Settings icon), Always-On Monitoring (Wifi icon, LIVE badge)

### 8. Flow Config

*`src/data/flowConfigs.ts`**

* Add `googledrive-tracker` entry with `isGoogleDriveAutomationFlow: true`

### 9. Flow Type

*`src/types/flows.ts`**

* Add `isGoogleDriveAutomationFlow?: boolean` to `FlowConfig` interface

### 10. Navigation Registration

*`src/pages/Threads.tsx`**

* Add `'googledrive-tracker'` to `flowEnabledThreads` array

*`src/pages/FlowPage.tsx`**

* Import `GoogleDriveAutomationFlow`

* Add render block: `if (config.isGoogleDriveAutomationFlow) return <GoogleDriveAutomationFlow />;`

### 11. Edge Function Config

*`supabase/config.toml`**

* Add `[functions.googledrive-automation-triggers]` with `verify_jwt = false`

* Add `[functions.googledrive-automation-webhook]` with `verify_jwt = false`

## Technical Details

### Webhook Trigger Setup (activate action)

```text

POST /api/v3/trigger_instances/GOOGLEDRIVE_NEW_FILE_MATCHING_QUERY_TRIGGER/upsert

Body: {

  connected_account_id: "ca_...",

  trigger_config: {

    query: "mimeType='application/[vnd.google](http://vnd.google)-apps.document'"

  },

  webhook_url: "{SUPABASE_URL}/functions/v1/googledrive-automation-webhook"

}

```

### Document Export (for content extraction)

```text

POST /api/v3/tools/execute/GOOGLEDRIVE_EXPORT_FILE

Body: {

  connected_account_id: "ca_...",

  arguments: { fileId: "...", mimeType: "text/plain" }

}

```

### Database Tables (already exist)

* `googledrive_automation_config`: id, user_id, is_active, trigger_instance_id, documents_saved, last_sync_at, last_webhook_at

* `googledrive_processed_documents`: id, user_id, googledrive_file_id (deduplication)

### Brand Colors

* Accent: `#4285F4` (Google blue)

* Gradient: `blue` (matching thread gradient system)

* Icon: `FileText` from lucide-react

* Same card/badge/button patterns as Todoist and Fireflies trackers

* `flowMode: "thread"` with Auto + Thread badges

---

## Suggestions (only the deltas I’d make before you approve)

1. **Make it truly “no polling” by default**

   * In `activate`, **remove “runs initial poll”**. Activation should *only* create the Composio trigger + set `is_active=true`.

   * Keep “Check Now” as **manual backfill** only (user-initiated), not a background poll.

2. **Match your requested 2-step flow**

   * In `src/data/threadConfigs.ts`, **do not add a 3rd “Always-On Monitoring” step**. Keep it exactly:

     1. Connect Google Drive

     2. Document Monitoring Toggle (On/Off)

3. **Fix webhook → user routing so it’s reliable**

   * Don’t rely on “extracts trigger_id” (payloads vary). Route by *`trigger_instance_id`** (or equivalent field) and also store *`connected_account_id`** alongside it in `googledrive_automation_config` so you can validate the webhook belongs to that account.

   * Update the plan line in the webhook receiver to: “Extract `trigger_instance_id` (and fileId), look up user by `googledrive_automation_config.trigger_instance_id` (and confirm `connected_account_id` matches).”

4. **Security best-practice for edge functions**

   * Keep *`googledrive-automation-webhook`** as `verify_jwt=false` (it’s called by Composio).

   * Change *`googledrive-automation-triggers`** to `verify_jwt=true` and require the user’s Supabase session JWT (since it’s called from the app). This prevents anyone from activating/deactivating triggers without auth.

5. **Tighten the trigger query**

   * Update the trigger query to avoid noise:

     * `mimeType='application/vnd.google-apps.document' and trashed=false`

6. **Naming consistency**

   * This plan is good about `googledrive-automation-webhook` vs `googledrive-automation-triggers`. Just make sure the `webhook_url` and the function folder name stay exactly aligned (no `googledocs-webhook` naming leftovers).

Approve and implement this plan now. Do not add polling beyond the manual “Check Now” action. Do not make any other changes.