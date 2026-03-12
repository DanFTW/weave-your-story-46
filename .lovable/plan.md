## Add Dropbox as a Document Source to the Existing Google Drive Tracker Thread

### Approach

Add Dropbox document search and content reading as a second source inside the existing `/thread/googledrive-tracker` thread, reusing the same generate → preview → confirm flow. The UI gets a source selector (Google Drive / Dropbox tabs or toggle) in the search area, and the backend gets new Composio actions for Dropbox.

### Changes

**1. New edge function:** `supabase/functions/dropbox-doc-actions/index.ts`

A lean edge function with two actions:

- `search-docs`: Calls `DROPBOX_SEARCH_FILE_OR_FOLDER` via Composio to search by query, returns results in the same `GoogleDriveSearchResult`-compatible shape (id, name, createdTime, alreadySaved)
- `export-doc`: Calls `DROPBOX_READ_FILE` via Composio to get file content, returns `{ success, content, title, fileId }`

Requires: auth check, Dropbox connection lookup from `user_integrations` where `integration_id = 'dropbox'`, dedup check against `googledrive_processed_documents` (reuse same table with a `source` discriminator, or just use a separate identifier prefix). For simplicity, reuse the same `googledrive_processed_documents` table — prefix Dropbox file IDs with `dropbox:` to avoid collisions.

**2. Update hook:** `src/hooks/useGoogleDriveAutomation.ts`

- Add `activeSource: 'googledrive' | 'dropbox'` state
- Add `setActiveSource` setter
- Update `searchDocs` to call either `googledrive-automation-triggers` or `dropbox-doc-actions` based on `activeSource`
- Update `generateFromDoc` to call the correct edge function for export based on `activeSource`
- Update `confirmMemories` to mark doc as processed with the correct source prefix
- Expose `activeSource` and `setActiveSource` in the return

**3. Update** `DocumentSearch.tsx`

- Accept `activeSource` and `onSourceChange` props
- Add a segmented toggle at the top: Google Drive | Dropbox (two pill buttons)
- Clear search results when switching source
- Show the appropriate source icon/color per result
- Everything else stays the same

**4. Update** `GoogleDriveAutomationFlow.tsx`

- Check Dropbox connection status alongside Google Drive (both are optional — at least one must be connected)
- Pass `activeSource` and source change handler to `DocumentSearch`
- If only one source is connected, default to that and hide the toggle
- Update header subtitle to say "Document tracker" (already generic)

**5. Update types:** `src/types/googleDriveAutomation.ts`

- Add `source?: 'googledrive' | 'dropbox'` to `GoogleDriveSearchResult`
- Export `type DocSource = 'googledrive' | 'dropbox'`

**6. Config TOML**

- Add `[functions.dropbox-doc-actions]` with `verify_jwt = false`

### File Summary


| File                                                                        | Change                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `supabase/functions/dropbox-doc-actions/index.ts`                           | **New** — search + export via Composio Dropbox tools |
| `supabase/config.toml`                                                      | Add function entry                                   |
| `src/types/googleDriveAutomation.ts`                                        | Add `DocSource` type                                 |
| `src/hooks/useGoogleDriveAutomation.ts`                                     | Add source switching, route to correct edge function |
| `src/components/flows/googledrive-automation/DocumentSearch.tsx`            | Add source toggle UI                                 |
| `src/components/flows/googledrive-automation/GoogleDriveAutomationFlow.tsx` | Check Dropbox connection, pass source props          |


No redesign. Same flow, same preview/confirm UX. Additive only.