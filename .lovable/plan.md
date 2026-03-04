## Add Google Sheets Integration

### Files to create

1. `**src/assets/integrations/googlesheets.svg**` — Copy the user-uploaded official Google Sheets logo SVG  
  
Use the `googlesheets.svg` file I have already uploaded to the project. Do not create or modify the SVG file.

### Files to modify

2. `**src/data/integrations.ts**`
  - Add `googlesheets` entry in the Apps section (after `googledocs`)
  - Add `googlesheets` detail in `integrationDetails` with description, capabilities, and green gradient colors (`#0F9D58`, `#137333`, `#34A853`)
3. `**src/components/integrations/IntegrationIcon.tsx**`
  - Import `googlesheets.svg` and add to `iconImages` map
4. `**src/components/integrations/IntegrationLargeIcon.tsx**`
  - Import `googlesheets.svg` and add to `iconImages` map
5. `**src/components/integrations/IntegrationSection.tsx**`
  - Add `"googlesheets"` to `availableIntegrations` array
6. `**supabase/functions/composio-connect/index.ts**`
  - Add `googlesheets: "GOOGLESHEETS"` to `COMPOSIO_TOOLKIT_NAMES`
  - Add `googlesheets: "ac_P0DYB0XdGLn3"` to `AUTH_CONFIGS`
  - Add `"googlesheets"` to `VALID_TOOLKITS`
7. `**supabase/functions/composio-callback/index.ts**`
  - Add `"googlesheets"` / `"google_sheets"` mappings to `APP_TO_TOOLKIT`
  - Add Google Sheets profile block (same pattern as Google Maps/Calendar): call `fetchGoogleDocsProfile(connectionId)` for Google userinfo, derive name from email if needed

### Deployment

- Redeploy `composio-connect` and `composio-callback` edge functions