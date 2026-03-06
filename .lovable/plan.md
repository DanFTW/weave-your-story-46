

# Plan: Add API.Bible Integration

## Summary
Add API.Bible as a new integration in the Integrations page, following existing patterns for icon registration, integration data, Composio connect/callback configuration, and profile fetching.

## Key Facts
- **Composio toolkit slug**: `api_bible`
- **Auth config ID**: `ac_sBgIg_zusGDy`
- **Auth type**: API Key (like Coinbase -- uses `API_KEY_TOOLKITS` path in `composio-connect`)
- **Official logo SVG**: `https://docs.api.bible/d11b74afcf410f946a0233ac51f585f9/api-logo.svg`
- **Profile fetching**: Via Composio API (fetch connected account details from Composio, not directly from API.Bible since it has no user profile endpoint)

## Files to Change

### 1. Add official logo asset
- Download the official API.Bible SVG from their brand assets page and save as `src/assets/integrations/apibible.svg`

### 2. `src/components/integrations/IntegrationIcon.tsx`
- Import the new SVG asset
- Add `apibible: apibibleIcon` to the `iconImages` map

### 3. `src/components/integrations/IntegrationLargeIcon.tsx`
- Same pattern: import SVG, add to `iconImages` map

### 4. `src/data/integrations.ts`
- Add entry in `integrationSections[0].integrations` array (Apps section):
  ```
  { id: "apibible", name: "API.Bible", icon: "apibible", status: "unconfigured" }
  ```
- Add entry in `integrationDetails`:
  ```
  "apibible": {
    id: "apibible", name: "API.Bible", icon: "apibible", status: "unconfigured",
    description: "API.Bible allows Weave to access Scripture content from hundreds of Bible versions. Create memories from your favorite verses, passages, and devotional readings.",
    capabilities: ["Search verses", "Browse books", "Access Bible versions", "Read passages"],
    gradientColors: { primary: "#2862D7", secondary: "#1a4ba8", tertiary: "#4A90D9" }
  }
  ```
  (Blue gradient matching the API.Bible brand color from their logo)

### 5. `supabase/functions/composio-connect/index.ts`
- Add `apibible: "ac_sBgIg_zusGDy"` to `AUTH_CONFIGS`
- Add `"apibible"` to `VALID_TOOLKITS`
- Add `"apibible"` to `API_KEY_TOOLKITS` (API.Bible uses API Key auth)
- Add `apibible: "API_BIBLE"` to `COMPOSIO_TOOLKIT_NAMES`

### 6. `supabase/functions/composio-callback/index.ts`
- Add `"api_bible": "apibible"` (and aliases) to `APP_TO_TOOLKIT` map
- Add profile fetching block for `toolkit === "apibible"`:
  - Fetch connection details from the Composio connected accounts API (`GET /api/v3/connected_accounts/{connectionId}`)
  - Extract any available user metadata (email, name) from the Composio connection data
  - API.Bible itself has no user profile endpoint, so we rely on Composio's connection metadata for identity display

### 7. Deploy edge functions
- Redeploy `composio-connect` and `composio-callback`

