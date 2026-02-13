# Google Drive Document Tracker: Search + Auto-Monitor Toggle

## Overview

Redesign the `/flow/googledrive-tracker` page to provide two distinct capabilities on a single unified screen:

1. **Document Search** -- Search Google Drive documents by title and selectively save specific ones as memories
2. **Auto-Monitor Toggle** -- Switch on/off automatic monitoring of new documents (webhook-based)

Both features coexist on one page rather than being separate phases, matching the modular card-based design used throughout the app.

## Architecture

The current phase-based approach (`configure` -> `activating` -> `active`) will be replaced with a **single unified view** that always shows both the search section and the monitoring toggle. The `activating` phase is kept only as a brief transition overlay.

```text
+------------------------------------------+
|  [<]  Google Drive Document Tracker      |
|        Document tracker                  |
+------------------------------------------+
|                                          |
|  +-- Auto-Monitor Card ---------------+ |
|  | [icon] Automatic Monitoring  [====] | |
|  | Save new Google Docs as memories    | |
|  | Monitoring active        [Docs: 3]  | |
|  +------------------------------------+ |
|                                          |
|  +-- Document Search Card ------------+ |
|  | [Search by title...________] [Go]  | |
|  |                                     | |
|  | search results...                   | |
|  | [DocA title]  [Save as Memory]      | |
|  | [DocB title]  [Saved]               | |
|  +------------------------------------+ |
+------------------------------------------+

```

## Files to Create (2 new files)

### 1. `src/components/flows/googledrive-automation/DocumentSearch.tsx`

A self-contained search component for finding and saving individual documents:

- Search input with Google Drive blue accent, styled consistently with `ContactSearch.tsx` (rounded-xl, `bg-muted/50`, search icon)
- Calls the edge function with a new `search-docs` action, passing a user-provided title query
- Displays results as cards showing: document title, created date, and a "Save as Memory" button
- Already-saved documents (in `googledrive_processed_documents`) show a "Saved" badge instead
- Uses `Loader2` spinner while searching, empty state when no results
- Handles saving a single document: exports content + creates LIAM memory + marks as processed, all via a new `save-doc` edge function action
- Props: `onDocumentSaved` callback to update parent stats

### 2. `src/components/flows/googledrive-automation/MonitorToggle.tsx`

A card component for the auto-monitoring toggle:

- Card with `Switch` component (from `@/components/ui/switch`) to toggle monitoring on/off
- When toggling ON: calls `activateMonitoring()` (creates Composio webhook trigger)
- When toggling OFF: calls `deactivateMonitoring()` (disables trigger)
- Shows green pulse indicator + "Active" badge when monitoring is on
- Shows stats: documents saved count, last sync timestamp
- **No "Check Now" button** (webhook-only by default; avoids polling)
- Props: `isActive`, `stats`, `isActivating`, `onToggle`

## Files to Edit (5 existing files)

### 3. `src/components/flows/googledrive-automation/GoogleDriveAutomationFlow.tsx`

Major refactor of the main flow component:

- Remove phase-based conditional rendering (`configure` / `active` screens)
- Replace with a single unified layout that always renders both `MonitorToggle` and `DocumentSearch`
- Keep the `ActivatingScreen` overlay only during the brief activation transition
- Add `searchDocs` and `saveDoc` methods that call the edge function
- Wire up stats refresh after search-save actions
- Keep the existing auth-check and redirect logic unchanged

### 4. `src/hooks/useGoogleDriveAutomation.ts`

Add two new methods to the hook:

- `searchDocs(query: string)`: Calls edge function with `action: 'search-docs'` and `query` param. Returns array of `{ id, name, createdTime, webViewLink, alreadySaved }`.
- `saveDocument(fileId: string, fileName: string)`: Calls edge function with `action: 'save-doc'` and `fileId`/`fileName` params. Returns success boolean. Updates `documentsSaved` stat on success.
- Add state: `isSearching`, `searchResults`, `isSaving` (map of fileId to boolean for per-doc saving state)
- Simplify phase: remove `configure`/`active` distinction -- after auth, always show the unified view (phase becomes `auth-check` | `ready` | `activating`)

### 5. `src/types/googleDriveAutomation.ts`

Add new types:

- `GoogleDriveSearchResult`: `{ id: string; name: string; createdTime: string; webViewLink: string; alreadySaved: boolean }`
- Update `GoogleDriveAutomationPhase` to: `'auth-check' | 'ready' | 'activating'`

### 6. `supabase/functions/googledrive-automation-triggers/index.ts`

Add two new action handlers:

- `search-docs`: Takes a `query` string from the request body. Calls `GOOGLEDRIVE_SEARCH_FILE` with `arguments: { query: "mimeType='application/vnd.google-apps.document' and trashed=false and name contains '${query}'" }`. Cross-references results against `googledrive_processed_documents` to set `alreadySaved` flag. Returns the results array. Limited to 20 results.
- `save-doc`: Takes `fileId` from request body. Checks dedup table -- if already saved, returns `{ alreadySaved: true }`. Otherwise exports the doc via `GOOGLEDRIVE_EXPORT_FILE` with `arguments: { fileId, mimeType: "text/plain" }`, creates a single LIAM memory using `formatDocAsMemory`, marks as processed in dedup table, increments `documents_saved` counter. Returns `{ success: true }`.

### 7. `src/components/flows/googledrive-automation/index.ts`

Add exports for the two new components:

- `export { DocumentSearch } from "./DocumentSearch"`
- `export { MonitorToggle } from "./MonitorToggle"`

## Technical Details

### Search Query Construction

The edge function builds the Google Drive API query by escaping single quotes in the user input:

```text
mimeType='application/vnd.google-apps.document' and trashed=false and name contains 'USER_QUERY'

```

### Per-Document Save Flow

```text
User clicks "Save as Memory"
  -> Frontend calls hook.saveDocument(fileId, fileName)
    -> Edge function action: 'save-doc'
      -> Check dedup table (skip if exists)
      -> GOOGLEDRIVE_EXPORT_FILE (text/plain export)
      -> formatDocAsMemory (title + metadata + content, 8000 char limit)
      -> LIAM API /memory/create with GOOGLEDRIVE tag
      -> Insert into googledrive_processed_documents
      -> Increment documents_saved in config
    -> Frontend updates searchResults (mark as saved) + stats

```

### Consistent Styling

- Google Drive blue accent: `#4285F4`
- Search input: `pl-12 h-12 rounded-xl bg-secondary/50 border-0` (matching `ThreadFilterBar` pattern)
- Cards: `bg-card rounded-xl border border-border p-4`
- Switch toggle uses the standard `Switch` component from shadcn/ui
- "Save as Memory" buttons: `bg-[#4285F4] hover:bg-[#4285F4]/90 text-white`
- "Saved" state: muted badge with check icon

### Components Not Changed

- `AutomationConfig.tsx` -- will be removed/unused (replaced by `MonitorToggle`)
- `ActiveMonitoring.tsx` -- will be removed/unused (replaced by `MonitorToggle`)
- `ActivatingScreen.tsx` -- kept as-is for the brief transition overlay
- `googledrive-automation-webhook` -- no changes needed (webhook handling is independent)