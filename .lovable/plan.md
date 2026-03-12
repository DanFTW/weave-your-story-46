### Problem

The Google Drive Document Tracker currently lets the user search for a doc, but when they click save it creates a single raw memory directly from the export step instead of using the AI memory-generation flow.

The intended behavior is:

**search by document title/name → select doc → export the document body/content → generate multiple memories → preview/edit → confirm save**

### Changes

**1. Add** `export-doc` **action**  
**File:** `supabase/functions/googledrive-automation-triggers/index.ts`

Add a new `export-doc` action that only exports the selected document’s content and returns:

- `content`
- `title`
- `fileId`

This keeps **document retrieval** separate from **memory creation**.

Keep existing `save-doc` unchanged for monitoring/polling flows.

---

**2. Update Google Drive hook to support generate → preview → confirm**  
**File:** `src/hooks/useGoogleDriveAutomation.ts`

Follow the same pattern as the website scrape flow.

Add:

- `generatedMemories`
- `selectedDoc`
- `generateFromDoc(fileId, fileName)`
  - uses the selected doc’s **title/name** only for search/selection
  - calls `export-doc`
  - sends the exported **document content** into `generate-memories`
  - stores preview state
- preview editing helpers
- `confirmMemories()` to save approved memories, then mark the doc as processed

Update phases to include:

- `generating`
- `preview`
- `success`

---

**3. Update types**  
**File:** `src/types/googleDriveAutomation.ts`

Add:

- `generating`
- `preview`
- `success`

to `GoogleDriveAutomationPhase`.

---

**4. Update the flow component for new phases**  
**File:** `src/components/flows/googledrive-automation/GoogleDriveAutomationFlow.tsx`

Add UI for:

- generating state
- preview/edit state
- success state

Reuse the same patterns already used elsewhere. No redesign.

---

**5. Update DocumentSearch action**  
**File:** `src/components/flows/googledrive-automation/DocumentSearch.tsx`

Change the current action from immediate save to generate flow.

- keep **search by title/name**
- on selection, call `generateFromDoc`
- change button label from **Save** to **Generate**

---

### Summary

The key behavior should be:

- use the doc **title/name** to find the file
- use the doc’s **actual exported body/content** to generate memories
- preview/edit before saving
- do not create a single raw memory directly from metadata or export output

No new files needed. No redesign. Follow the same architecture and UX pattern as the website scrape flow.