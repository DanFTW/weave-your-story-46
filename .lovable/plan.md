

## Add Google Maps Integration

This adds Google Maps as a new integration to the `/integrations` page, following the exact same patterns used by all other integrations (Google Calendar, Google Drive, etc.).

### Changes Required

**1. Copy the official Google Maps SVG logo to assets**
- Copy the user-uploaded `Google_Maps_icon_2020.svg` to `src/assets/integrations/googlemaps.svg`

**2. Register in `src/data/integrations.ts`**
- Add `googlemaps` entry to the "Apps" section in `integrationSections` array (status: `"unconfigured"`)
- Add `googlemaps` entry to `integrationDetails` record with description, capabilities (e.g., "View places", "Access directions", "Search locations", "View saved places"), and gradient colors matching Google Maps brand (`#1a73e8` blue, `#ea4335` red, `#34a853` green, `#fbbc04` yellow)

**3. Register icon in both `IntegrationIcon.tsx` and `IntegrationLargeIcon.tsx`**
- Import `googlemapsIcon` from `@/assets/integrations/googlemaps.svg`
- Add `googlemaps: googlemapsIcon` to the `iconImages` map in both files

**4. Add auth config to `composio-connect` edge function**
- Add `googlemaps: "ac_dg71KiJ5nLgN"` to the `AUTH_CONFIGS` map
- Add `"googlemaps"` to `VALID_TOOLKITS` array

**5. Add toolkit mapping and profile fetching to `composio-callback` edge function**
- Add `"googlemaps": "googlemaps"` and `"google_maps": "googlemaps"` to the `APP_TO_TOOLKIT` map
- Add a Google Maps profile fetch block that uses the same pattern as Google Drive/Google Calendar: fetch the Composio connection to get `access_token`, call Google `userinfo` endpoint (`https://www.googleapis.com/oauth2/v3/userinfo`), fall back to cross-integration lookup via `fetchExistingGoogleProfile`. This fetches profile image, name, and email from the Google account (since Google Maps uses Google OAuth, the user's Google profile is the relevant identity)
- Add `"googlemaps"` to the cross-integration lookup list in `fetchExistingGoogleProfile`

### Technical Notes
- Google Maps is a Google OAuth service, so the profile fetching strategy is identical to Google Calendar/Google Drive/Google Docs -- use the Composio connection's `access_token` to call Google's `userinfo` endpoint, which returns name, email, and avatar. No Google Maps-specific API is needed for profile data.
- No database migration needed -- uses existing `user_integrations` table.
- No new edge functions needed -- reuses `composio-connect`, `composio-callback`, `composio-disconnect`.

