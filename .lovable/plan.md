# Add Google Drive Integration to /integrations Page

## Overview

Add a new "Google Drive" integration card to the Integrations page with full OAuth connection support, profile fetching via Composio API, and the official Google Drive brand logo.

## Important Note on Auth Config ID

You provided auth config ID **ac_7m7XMBKrLl_O**, which is currently assigned to Fireflies in the codebase. The memory context indicates Google Drive uses `ac_7m7XMBKrLI_O`. **The plan will use** `ac_7m7XMBKrLI_O` **(capital I) to avoid the** `LI` **vs** `Ll` **mismatch.**

## Changes

### 1. Download official Google Drive logo

Save the official Google Drive SVG logo (from Simple Icons / official brand assets) as `src/assets/integrations/googledrive.svg` using official brand colors (blue #4285F4, green #0F9D58, yellow #F4B400).

### 2. `src/components/integrations/IntegrationIcon.tsx`

- Import the new `googledrive.svg` asset
- Add `googledrive` entry to the `iconImages` map

### 3. `src/data/integrations.ts`

- Add `googledrive` entry to the Apps section in `integrationSections` array (status: `unconfigured`)
- Add `googledrive` entry to `integrationDetails` with:
  - Description about monitoring Drive files and creating memories
  - Capabilities: "View files", "Browse folders", "Monitor new documents", "Access shared content"
  - Gradient colors using Google Drive brand palette (blue/green/yellow)

### 4. `supabase/functions/composio-connect/index.ts`

- Add `googledrive: "ac_7m7XMBKrLI_O"` to `AUTH_CONFIGS` map
- Add `"googledrive"` to `VALID_TOOLKITS` array

### 5. `supabase/functions/composio-callback/index.ts`

- Add `googledrive` / `google_drive` / `gdrive` mappings to `APP_TO_TOOLKIT`
- Add a `googledrive` profile-fetching block in the main handler that **fetches profile fields from Composio connected account metadata (via Composio API), not Google userinfo endpoints**, with cross-integration fallback via `fetchExistingGoogleProfile`

### Files Modified


| File                                              | Change                                 |
| ------------------------------------------------- | -------------------------------------- |
| `src/assets/integrations/googledrive.svg`         | New file -- official Google Drive logo |
| `src/components/integrations/IntegrationIcon.tsx` | Import and map `googledrive` icon      |
| `src/data/integrations.ts`                        | Add integration entry + detail config  |
| `supabase/functions/composio-connect/index.ts`    | Add auth config + valid toolkit        |
| `supabase/functions/composio-callback/index.ts`   | Add toolkit mapping + profile fetching |



| File                                              | Change                                 |
| ------------------------------------------------- | -------------------------------------- |
| `src/assets/integrations/googledrive.svg`         | New file -- official Google Drive logo |
| `src/components/integrations/IntegrationIcon.tsx` | Import and map `googledrive` icon      |
| `src/data/integrations.ts`                        | Add integration entry + detail config  |
| `supabase/functions/composio-connect/index.ts`    | Add auth config + valid toolkit        |
| `supabase/functions/composio-callback/index.ts`   | Add toolkit mapping + profile fetching |
