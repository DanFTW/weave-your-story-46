## Fix Dropbox document generation in the existing Google Drive Tracker thread

In the existing `/thread/googledrive-tracker` thread, the **Dropbox** path is failing at **Generate**. A user can search and select a Dropbox document, but clicking Generate returns:

**Generation failed — Could not extract any memories from this document**

Please fix this so Dropbox documents reliably generate memories from the **actual file contents**.

### Intended behavior

- search Dropbox by document title/name
- select a document
- read the document’s actual contents via `DROPBOX_READ_FILE`
- pass that content into the existing memory-generation flow
- return generated memories / preview instead of the current failure state

### Requirements

- use `DROPBOX_SEARCH_FILE_OR_FOLDER` only for search
- use `DROPBOX_READ_FILE` for the selected document’s contents
- generate memories from the **document contents**, not the link, title, metadata, or an empty/misparsed response
- normalize the Dropbox read result into the shape expected by the existing `generate-memories` pipeline
- add targeted logging around Dropbox read → memory generation so the real failure is visible if this happens again
- only show “could not extract any memories” when the document truly has no usable content, not when parsing or mapping failed

Keep this scoped and minimal. This is a targeted bug fix in the existing thread, not a redesign. Follow the existing flow, UX patterns, styling, and architecture, and do not make unrelated codebase changes.