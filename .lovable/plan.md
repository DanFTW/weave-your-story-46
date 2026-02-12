

# Add Fireflies.ai Integration

## Overview
Add Fireflies.ai (AI meeting notetaker) to the integrations page, following the exact patterns used by existing integrations. This includes the icon, integration listing, detail page config, OAuth connection via Composio, and profile fetching.

## Files to Create

### 1. `src/assets/integrations/fireflies.svg`
Create an SVG icon reproducing the official Fireflies.ai brand mark -- a geometric "F" composed of colored blocks in their brand colors (purple #6C3AED, pink/magenta #DB2777, and lighter pink #F472B6). The icon uses a `0 0 24 24` viewBox consistent with all other integration icons. The design is 4 quadrants forming an abstract "F" shape.

## Files to Modify

### 2. `src/data/integrations.ts`
- Add `fireflies` entry to the "Apps" section in `integrationSections` array (status: `"unconfigured"`)
- Add `fireflies` entry to `integrationDetails` with:
  - Description about meeting transcription and AI notetaking
  - Capabilities: "Transcribe meetings", "View transcripts", "Access summaries", "Search conversations"
  - Gradient colors: primary `#6C3AED` (purple), secondary `#DB2777` (pink), tertiary `#7C3AED`

### 3. `src/components/integrations/IntegrationIcon.tsx`
- Import `firefliesIcon` from the new SVG asset
- Add `fireflies` entry to `iconImages` map

### 4. `src/components/integrations/IntegrationLargeIcon.tsx`
- Import `firefliesIcon` from the new SVG asset
- Add `fireflies` entry to `iconImages` map

### 5. `supabase/functions/composio-connect/index.ts`
- Add `fireflies: "ac_67tCzpRn7AdZ"` to `AUTH_CONFIGS` map
- Add `"fireflies"` to `VALID_TOOLKITS` array

### 6. `supabase/functions/composio-callback/index.ts`
Three additions:

**a) APP_TO_TOOLKIT mapping** -- Add entries:
```
"fireflies": "fireflies",
"fireflies_ai": "fireflies",
"firefliesai": "fireflies",
```

**b) Profile fetch function** -- Add `fetchFirefliesProfile` that:
1. Gets the `access_token` from Composio connection metadata
2. Calls the Fireflies GraphQL API (`POST https://api.fireflies.ai/graphql`) with:
   ```graphql
   { user { name email user_id } }
   ```
   Using `Authorization: Bearer {access_token}`
3. Returns `name`, `email`, and `null` for avatar (Fireflies API does not expose profile pictures)

**c) Toolkit handler block** -- Add the `if (toolkit === "fireflies")` block to extract access_token from Composio data and call `fetchFirefliesProfile`, following the same pattern as Todoist/Zoom/HubSpot (direct API with access token).

## Technical Details

- Auth Config ID: `ac_67tCzpRn7AdZ`
- Toolkit name: `FIREFLIES` (Composio)
- Profile API: GraphQL at `https://api.fireflies.ai/graphql`
- Profile fields available: `name`, `email`, `user_id`
- Profile picture: Not available via Fireflies API -- UI will show initials fallback
- Brand colors: Purple `#6C3AED`, Pink `#DB2777`

## What Does NOT Change
- No new database tables
- No new frontend pages or components
- No new hooks
- No changes to IntegrationDetail page (it already works generically)
- No changes to authentication flow (useComposio handles it)

