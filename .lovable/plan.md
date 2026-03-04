

## Plan: Add Google Calendar Integration

### Overview
Add Google Calendar as a new connectable integration following the exact patterns used by other Google services (Google Docs, Google Tasks, Google Drive). Profile fetching uses the Composio connection's access token to call Google userinfo, with cross-integration fallback.

### Files to modify

**1. Copy icon asset**
- Copy `user-uploads://Google_Calendar_icon_2020.svg` → `src/assets/integrations/googlecalendar.svg`

**2. `src/data/integrations.ts`**
- Add entry in `integrationSections[0].integrations` array (Apps section):
  ```
  { id: "googlecalendar", name: "Google Calendar", icon: "googlecalendar", status: "unconfigured" }
  ```
- Add detail entry in `integrationDetails`:
  ```
  "googlecalendar": {
    id: "googlecalendar", name: "Google Calendar", icon: "googlecalendar", status: "unconfigured",
    description: "Google Calendar allows Weave to access your events, schedules, and reminders...",
    capabilities: ["View events", "Access calendars", "Read reminders", "View schedules"],
    gradientColors: { primary: "#4285F4", secondary: "#EA4335", tertiary: "#34A853", quaternary: "#FBBC05" }
  }
  ```

**3. `src/components/integrations/IntegrationIcon.tsx`** and **`IntegrationLargeIcon.tsx`**
- Add import: `import googlecalendarIcon from "@/assets/integrations/googlecalendar.svg";`
- Add to `iconImages` map: `googlecalendar: googlecalendarIcon`

**4. `src/components/integrations/IntegrationSection.tsx`**
- Add `"googlecalendar"` to the `availableIntegrations` array

**5. `supabase/functions/composio-connect/index.ts`**
- Add to `COMPOSIO_TOOLKIT_NAMES`: `googlecalendar: "GOOGLECALENDAR"`
- Add to `AUTH_CONFIGS`: `googlecalendar: "ac_Tahf9NrBD7Vy"`
- Add `"googlecalendar"` to `VALID_TOOLKITS` array

**6. `supabase/functions/composio-callback/index.ts`**
- Add to `APP_TO_TOOLKIT` map: `"googlecalendar": "googlecalendar"`, `"google_calendar": "googlecalendar"`
- Add profile fetching block (same pattern as googletasks/googledrive — reuses `fetchGoogleDocsProfile` for Google userinfo, falls back to `fetchExistingGoogleProfile` cross-integration lookup):
  ```
  if (toolkit === "googlecalendar") {
    let profileInfo = await fetchGoogleDocsProfile(connectionId);
    if (!profileInfo.email && !profileInfo.name) {
      profileInfo = await fetchExistingGoogleProfile(supabase, resolvedUserId);
    }
    // assign accountEmail, accountName, accountAvatarUrl
  }
  ```
- Add `"googlecalendar"` to the cross-integration lookup query in `fetchExistingGoogleProfile` (the `.in()` array)

### No database changes needed
The existing `user_integrations` table handles all integrations generically.

