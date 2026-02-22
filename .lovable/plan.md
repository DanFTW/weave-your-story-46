

# Add iOS Device Contacts Integration (Despia Native Bridge)

## Overview
Add an "iOS Contacts" integration that uses the `despia-native` SDK to read device contacts when running inside the Despia iOS wrapper app. No OAuth or Composio is involved -- this is a direct native bridge call.

## What Changes

### 1. Add integration entry to `src/data/integrations.ts`
- Add `ios-contacts` to the "System integrations (future)" section (alongside location-services and camera-access), with name "iOS Contacts", icon "location" (reusing an existing icon, or we can add a contacts icon), and status "unconfigured".
- Add a corresponding `integrationDetails` entry with description, capabilities (e.g., "Read contacts", "Access phone numbers"), and gradient colors.

### 2. Add `ios-contacts` to the available integrations list in `IntegrationSection.tsx`
- Add `"ios-contacts"` to the `availableIntegrations` array so it shows as connectable (not "coming soon").

### 3. Create `src/hooks/useIOSContacts.ts`
A custom hook that mirrors the `useComposio` return shape (`UseComposioReturn`-compatible) but uses Despia native calls instead of Composio OAuth:

- **Environment detection:** Check user agent for "despia" + "iphone"/"ipad" to determine if the bridge is available.
- **`connect`:** Calls `despiaSDK('requestcontactpermission://')` then `despiaSDK('readcontacts://', ['contacts'])`. On success, upserts to `user_integrations` with `integration_id: "ios-contacts"`, `account_name: "iOS Contacts"`, `account_email: "${count} contacts synced"`.
- **`disconnect`:** Deletes the `user_integrations` row where `integration_id = "ios-contacts"`.
- **`checkStatus`:** Reads from `user_integrations` to populate `connectedAccount` and `isConnected`.
- Returns `{ connectedAccount, connecting, isConnected, connect, disconnect, checkStatus }`.

### 4. Update `src/pages/IntegrationDetail.tsx`
- Detect when `integrationId === "ios-contacts"`.
- Use `useIOSContacts()` instead of `useComposio()` for this integration.
- Skip the `OAuthConfirmDialog` -- instead, call `connect()` directly when the user taps "Connect your account".
- When not running inside Despia (desktop/browser), show a message like "This integration is only available in the iOS app."
- The rest of the UI (connected account card, capabilities, done button) works unchanged since the hook returns the same shape.

## Technical Details

### Hook interface (matches useComposio)
```text
connectedAccount: { name: string, email: string, avatarUrl?: string } | null
connecting: boolean
isConnected: boolean
connect(customRedirectPath?: string, forceReauth?: boolean): Promise<void>
disconnect(): Promise<void>
checkStatus(): Promise<void>
```

### Database interaction
Uses the existing `user_integrations` table -- no migration needed. The `composio_connection_id` column is nullable and will be left null for iOS Contacts.

### Icon
Will need a contacts icon asset. Can reuse the existing `location.png` temporarily or add a new icon file. The simplest approach is to use the Lucide `Contact` icon as a fallback in `IntegrationIcon` and `IntegrationLargeIcon` when `icon === "ios-contacts"`.

### No edge functions needed
Everything runs client-side via the Despia native bridge. No Supabase edge functions are created or modified.

