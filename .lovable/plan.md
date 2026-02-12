# Google Drive Document Tracker -- Implementation Plan

## Summary

Add a new "Google Drive Document Tracker" automation thread that monitors a connected Google Drive account for new Google Docs documents and automatically saves them as memories. The implementation mirrors the Fireflies Transcript Tracker pattern: Connect Google Drive, toggle monitoring on/off, with Composio webhook triggers for automatic capture and a manual "Check Now" for backfill.

## Prerequisites

A new `googledrive` integration must be registered (auth config `ac_7m7XMBKrLI_O`), separate from the existing `googledocs` integration. A Google Drive SVG icon asset is also needed.

---

## Step 1: Database Migration

Create two tables with RLS policies:

`googledrive_automation_config`


| Column              | Type        | Notes                                |
| ------------------- | ----------- | ------------------------------------ |
| id                  | uuid        | PK, default gen_random_uuid()        |
| user_id             | uuid        | FK, unique, not null                 |
| is_active           | boolean     | default false                        |
| trigger_instance_id | text        | nullable, stores Composio trigger ID |
| documents_saved     | integer     | default 0                            |
| last_sync_at        | timestamptz | nullable                             |
| last_webhook_at     | timestamptz | nullable                             |
| created_at          | timestamptz | default now()                        |
| updated_at          | timestamptz | default now()                        |


RLS policies: Users can SELECT, INSERT, UPDATE their own rows (auth.uid() = user_id). Auto-update `updated_at` via trigger.

`googledrive_processed_documents`


| Column              | Type        | Notes                         |
| ------------------- | ----------- | ----------------------------- |
| id                  | uuid        | PK, default gen_random_uuid() |
| user_id             | uuid        | FK, not null                  |
| googledrive_file_id | text        | not null                      |
| created_at          | timestamptz | default now()                 |


Unique constraint on (user_id, googledrive_file_id). RLS: Users can SELECT and INSERT their own rows.

---

## Step 2: Register Google Drive Integration

`supabase/functions/composio-connect/index.ts`

- Add `googledrive: "ac_7m7XMBKrLI_O"` to AUTH_CONFIGS map
- Add `"googledrive"` to supported integrations array

`src/data/integrations.ts`

- Add `googledrive` entry to integrationSections (Apps list)
- Add `googledrive` integration detail with name "Google Drive", description, capabilities, and gradient colors (blue themed)

`src/assets/integrations/googledrive.svg`

- Add official Google Drive triangle logo SVG

---

## Step 3: New Files -- Types and Hook

`src/types/googledriveAutomation.ts`

- `GoogleDriveAutomationPhase`: `'auth-check' | 'configure' | 'activating' | 'active'`
- `GoogleDriveAutomationConfig`: id, userId, isActive, triggerInstanceId, documentsSaved, lastSyncAt, lastWebhookAt, createdAt, updatedAt
- `GoogleDriveAutomationStats`: documentsSaved, isActive, lastSyncAt

`src/hooks/useGoogleDriveAutomation.ts`

- Mirrors `useFirefliesAutomation.ts` structure exactly
- Reads/creates `googledrive_automation_config` row
- `activateMonitoring` invokes `googledrive-automation-triggers` with `action: 'activate'`
- `deactivateMonitoring` invokes with `action: 'deactivate'`
- `manualSync` invokes with `action: 'manual-poll'`
- No webhook URL/secret display (unlike Fireflies, Google Drive uses Composio triggers not user-pasted webhooks)

---

## Step 4: Edge Functions

`supabase/functions/googledrive-automation-triggers/index.ts`

Three actions: `activate`, `deactivate`, `manual-poll`

- **activate**: Creates a Composio trigger instance for Google Drive **"New File Matching Query"** event filtered to Google Docs mimeType using the query `mimeType='application/vnd.google-apps.document' and trashed=false`. Stores `trigger_instance_id` in config. Runs initial backfill sync.
- **deactivate**: Disables/deletes the Composio trigger instance, sets `is_active = false`.
- **manual-poll**: Lists recent Google Drive files via Composio `GOOGLEDRIVE_LIST_FILES` (filtered to `mimeType='application/vnd.google-apps.document' and trashed=false`), deduplicates against `googledrive_processed_documents`, fetches full document text via Google Docs export endpoint, creates LIAM memories with `tag: "GOOGLEDRIVE"`.

Includes: LIAM crypto utilities (copied from Fireflies pattern), chunking for large documents (MAX_MEMORY_CHUNK_SIZE = 8000), rate limiting between API calls.

`supabase/functions/googledrive-webhook/index.ts`

Public webhook receiver for Composio trigger deliveries:

- Extracts `fileId` from event payload
- Validates it's a Google Docs document
- Deduplicates via `googledrive_processed_documents`
- Fetches full text content via export endpoint
- Creates LIAM memory with `tag: "GOOGLEDRIVE"`
- Updates `googledrive_automation_config` stats

`supabase/config.toml`

- Add `[functions.googledrive-automation-triggers]` with `verify_jwt = false`
- Add `[functions.googledrive-webhook]` with `verify_jwt = false`

---

## Step 5: Flow UI Components

All under `src/components/flows/googledrive-automation/`:

`GoogleDriveAutomationFlow.tsx`

- Auth gate: checks connection via `useComposio('GOOGLEDRIVE')`
- Redirects to `/integration/googledrive` if not connected
- Renders `AutomationConfig` or `ActiveMonitoring` based on phase
- Blue gradient header (matching Google Drive brand)

`AutomationConfig.tsx`

- Card with `FileText` icon explaining document monitoring
- "Activate Monitoring" button (blue: `#4285F4`)

`ActiveMonitoring.tsx`

- Green pulse status indicator
- Documents saved count
- "Check Now" and "Pause" buttons
- No webhook URL section (unlike Fireflies -- Composio handles this automatically)

`ActivatingScreen.tsx`

- Loading spinner during activation (blue themed)

`index.ts`

- Barrel export

---

## Step 6: Registry Updates

`src/data/threads.ts`

- Add `googledrive-tracker` entry with: `icon: FileText`, `gradient: "blue"`, `integrations: ["googledrive"]`, `flowMode: "thread"`, `triggerType: "automatic"`

`src/data/threadConfigs.ts`

- Add `googledrive-tracker` config with 3 steps: Connect Google Drive, Document Monitoring toggle, Always-On Monitoring

`src/data/flowConfigs.ts`

- Add `googledrive-tracker` entry with `isGoogleDriveAutomationFlow: true`, `memoryTag: "GOOGLEDRIVE"`

`src/types/flows.ts`

- Add `isGoogleDriveAutomationFlow?: boolean` to `FlowConfig` interface

`src/pages/FlowPage.tsx`

- Import `GoogleDriveAutomationFlow`
- Add render branch: `if (config.isGoogleDriveAutomationFlow) return <GoogleDriveAutomationFlow />`

`src/pages/Threads.tsx` and `src/pages/ThreadOverview.tsx`

- Add `'googledrive-tracker'` to both `flowEnabledThreads` arrays

`src/components/memories/MemoryCard.tsx`

- Add `googledrive` to `categoryConfig`: `{ icon: FileText, gradient: "bg-gradient-to-r from-blue-500 to-blue-600", label: "Google Drive Document Tracker" }`
- Add `'googledrive'` to `CATEGORY_TAGS` set

---

## Files Summary

**New files (10)**:

- `src/types/googledriveAutomation.ts`
- `src/hooks/useGoogleDriveAutomation.ts`
- `src/components/flows/googledrive-automation/GoogleDriveAutomationFlow.tsx`
- `src/components/flows/googledrive-automation/AutomationConfig.tsx`
- `src/components/flows/googledrive-automation/ActiveMonitoring.tsx`
- `src/components/flows/googledrive-automation/ActivatingScreen.tsx`
- `src/components/flows/googledrive-automation/index.ts`
- `src/assets/integrations/googledrive.svg`
- `supabase/functions/googledrive-automation-triggers/index.ts`
- `supabase/functions/googledrive-webhook/index.ts`

**Modified files (11)**:

- `supabase/config.toml`
- `supabase/functions/composio-connect/index.ts`
- `src/data/integrations.ts`
- `src/data/threads.ts`
- `src/data/threadConfigs.ts`
- `src/data/flowConfigs.ts`
- `src/types/flows.ts`
- `src/pages/FlowPage.tsx`
- `src/pages/Threads.tsx`
- `src/pages/ThreadOverview.tsx`
- `src/components/memories/MemoryCard.tsx`

**Database migration (1)**:

- Two tables: `googledrive_automation_config`, `googledrive_processed_documents`