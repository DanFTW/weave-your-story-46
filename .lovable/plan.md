# Google Drive Document Tracker Thread

## Overview

Create a new automation thread that monitors a connected Google Drive account for new Google Docs documents and automatically saves them as memories. The implementation mirrors the Fireflies Transcript Tracker pattern exactly: Connect -> Toggle Monitoring -> Active Monitoring with Composio webhook triggers (no polling).

## Files to Create

### 1. Database Tables (SQL migration)

Two new tables following the Fireflies pattern:

`googledocs_automation_config`

- `id` (uuid, PK)
- `user_id` (uuid, FK, unique)
- `is_active` (boolean, default false)
- `trigger_instance_id` (text, nullable)
- `documents_saved` (integer, default 0)
- `last_sync_at` (timestamptz, nullable)
- `last_webhook_at` (timestamptz, nullable)
- `created_at` / `updated_at` (timestamptz)

`googledocs_processed_documents`

- `id` (uuid, PK)
- `user_id` (uuid, FK)
- `googledocs_document_id` (text, not null)
- `created_at` (timestamptz)
- Unique constraint on `(user_id, googledocs_document_id)`

### 2. Type Definition

`src/types/googledocsAutomation.ts`

- `GoogleDocsAutomationPhase`: `'auth-check' | 'configure' | 'activating' | 'active'`
- `GoogleDocsAutomationConfig` and `GoogleDocsAutomationStats` interfaces (mirrors Fireflies types)

### 3. Custom Hook

`src/hooks/useGoogleDocsAutomation.ts`

- Same structure as `useFirefliesAutomation.ts`
- Manages phase, config, stats, loading states
- `loadConfig` reads/creates `googledocs_automation_config` row
- `activateMonitoring` calls edge function with `action: 'activate'`
- `deactivateMonitoring` calls with `action: 'deactivate'`
- `manualSync` calls with `action: 'manual-poll'`

### 4. Edge Function

`supabase/functions/googledocs-automation-triggers/index.ts`

- Same architecture as `fireflies-automation-triggers`
- Creates a Composio Trigger Instance for Google Drive **“New File Matching Query”** with query:
  - `mimeType='application/vnd.google-apps.document' and trashed=false`
- Stores Composio `trigger_instance_id` into `googledocs_automation_config`
- For initial backfill and the optional "Check Now" action, uses Composio tool `GOOGLEDRIVE_LIST_FILES` (or Google Drive API fallback via access token) to list documents
- For each new document, fetches full content via Google Docs export (`https://docs.google.com/document/d/{id}/export?mimeType=text/plain`)
- Deduplicates via `googledocs_processed_documents` table
- Creates LIAM memories with `tag: "GOOGLEDOCS"`, includes document title and full text content
- Supports chunking for large documents (same `MAX_MEMORY_CHUNK_SIZE = 8000` pattern)
- Three actions: `activate`, `deactivate`, `manual-poll`

### 5. Webhook Edge Function

`supabase/functions/googledocs-webhook/index.ts`

- Public webhook receiver for Composio trigger deliveries
- Validates the event, extracts `fileId`, dedupes via `googledocs_processed_documents`
- Fetches full document content via export endpoint
- Creates LIAM memories with `tag: "GOOGLEDOCS"` and updates `googledocs_automation_config` (`documents_saved`, `last_webhook_at`)

### 6. Flow UI Components

`src/components/flows/googledocs-automation/GoogleDocsAutomationFlow.tsx`

- Auth gate pattern: checks Google Drive connection via `useComposio('GOOGLEDRIVE')`
- Redirects to `/integration/googledrive` if not connected
- Renders `AutomationConfig` or `ActiveMonitoring` based on phase
- Uses blue gradient (matching Google Docs brand)

`src/components/flows/googledocs-automation/AutomationConfig.tsx`

- Single card explaining document monitoring
- "Activate Monitoring" button (blue themed)

`src/components/flows/googledocs-automation/ActiveMonitoring.tsx`

- Green pulse status indicator
- Documents saved count
- "Check Now" and "Pause" buttons

`src/components/flows/googledocs-automation/ActivatingScreen.tsx`

- Loading spinner during activation

`src/components/flows/googledocs-automation/index.ts`

- Barrel export

## Files to Modify

### 7. Thread Registration

`src/data/threads.ts`

- Add `googledocs-tracker` entry at the top of the array (with other automation threads):
  - `icon: FileText` (from lucide-react)
  - `gradient: "blue"`
  - `integrations: ["googledrive"]`
  - `flowMode: "thread"`, `triggerType: "automatic"`

### 8. Thread Config

`src/data/threadConfigs.ts`

- Add `googledocs-tracker` config with 2 steps: Connect Google Drive, Document Monitoring toggle

### 9. Flow Config

`src/data/flowConfigs.ts`

- Add `googledocs-tracker` entry with `isGoogleDocsAutomationFlow: true`, `memoryTag: "GOOGLEDOCS"`

### 10. Flow Type

`src/types/flows.ts`

- Add `isGoogleDocsAutomationFlow?: boolean` to `FlowConfig` interface

### 11. Flow Page Routing

`src/pages/FlowPage.tsx`

- Import `GoogleDocsAutomationFlow`
- Add render branch: `if (config.isGoogleDocsAutomationFlow) return <GoogleDocsAutomationFlow />`

### 12. Thread Navigation Arrays

`src/pages/Threads.tsx` and `src/pages/ThreadOverview.tsx`

- Add `'googledocs-tracker'` to `flowEnabledThreads` arrays

### 13. Memory Card Branding

`src/components/memories/MemoryCard.tsx`

- Add `googledocs` entry to `categoryConfig`: `{ icon: FileText, gradient: "bg-gradient-to-r from-blue-500 to-blue-600", label: "Google Drive Document Tracker" }`
- Add `'googledocs'` to `CATEGORY_TAGS` set

### 14. Edge Function Config

`supabase/config.toml`

- Add `[functions.googledocs-automation-triggers]` with `verify_jwt = false`
- Add `[functions.googledocs-webhook]` with `verify_jwt = false`

## Technical Notes

- Google Drive Composio Auth Config ID: `ac_7m7XMBKrLI_O`
- Integration ID used throughout: `googledrive`
- Composio Trigger used: **New File Matching Query** filtered to Google Docs mimeType
- Full text is exported as plain text for memory storage
- Always-on monitoring is webhook-driven (no pg_cron needed); the optional "Check Now" triggers a one-off backfill/sync for verification and initial catch-up