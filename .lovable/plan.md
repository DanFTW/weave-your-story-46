## Rebrand the Google Drive Tracker thread as "Document Tracker"

This is a copy/branding pass across 5 files. No architecture or logic changes.

### Changes


| File                                                                      | What changes                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/threads.ts` (~line 149-157)                                     | Title → `"Document Tracker"`, integrations → `["googledrive", "dropbox"]`                                                                                                                                                                                                                                                                                                                                             |
| `src/data/threadConfigs.ts` (~lines 915-945)                              | Title → `"Document Tracker"`, subtitle → `"Save documents as memories"`, description → `"Save documents from Google Drive or Dropbox as memories."`, Step 1 title → `"Connect Google Drive or Dropbox"`, description → `"Authorize access to your documents"`, use a neutral `FileText` icon instead of the Google Drive SVG for step 1                                                                               |
| `src/data/flowConfigs.ts` (~lines 536-548)                                | Title → `"Document Tracker"`, subtitle → `"Search & generate from documents"`, description → `"Save documents from Google Drive or Dropbox as memories."`                                                                                                                                                                                                                                                             |
| `src/components/flows/googledrive-automation/MonitorToggle.tsx` (line 22) | Change `"Save new Google Docs as memories"` → `"Save new documents as memories"`                                                                                                                                                                                                                                                                                                                                      |
| `src/components/ThreadCard.tsx` (~lines 47-55)                            | Handle multi-integration threads: when a thread has multiple integrations (e.g. `["googledrive", "dropbox"]`), fall back to `gradientFallbackColors` using the thread's gradient instead of showing only the first integration's icon. For the icon, render the thread's `icon` (FileText) instead of a single provider logo — this gives the card a neutral document feel rather than being branded to one provider. |


### Thread card icon strategy

The card currently shows the first integration's logo (Google Drive). For a multi-provider thread, showing a single provider logo is misleading. Instead, for threads with 2+ service integrations, the card will use the thread's own `icon` prop (FileText) and the gradient fallback colors. This keeps the card clean and provider-neutral without cramming two logos into a small space.

### How-it-works screen

Step 1 currently shows the Google Drive SVG via `iconUrl`. It will switch to using a `FileText` icon (via the `icon` property instead of `iconUrl`) with copy saying "Connect Google Drive or Dropbox". Steps 2 and 3 are already provider-neutral and need no changes.

### Active thread screen

The `MonitorToggle` copy is the only Google-specific text. The `DocumentSearch` component already has a provider toggle and neutral copy — no changes needed there. The flow header already says "Document Tracker" in the screenshot, so `GoogleDriveAutomationFlow.tsx` needs no title changes (it already uses the phase-based title).