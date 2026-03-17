

## Plan: Remove Album Picker, Sync All Photos Directly

**Problem**: `GOOGLEPHOTOS_LIST_ALBUMS` only returns albums created by the app (Google Photos API restriction), so the album picker is always empty. The flow should skip album selection entirely and sync from the user's full library using `GOOGLEPHOTOS_SEARCH_MEDIA_ITEMS`.

### Changes (6 files)

**1. Edge function** (`supabase/functions/google-photos-sync/index.ts`)
- Remove `list-albums` action case and `listAlbums()` function
- Remove `list-album-photos` action case and `listAlbumPhotos()` function
- In `syncPhotos()`, remove the album-specific branch — always call `listPhotos()` directly (no `selectedAlbumIds` logic)

**2. Hook** (`src/hooks/useGooglePhotosSync.ts`)
- Remove album state: `albums`, `selectedAlbumIds`, `albumPhotos`, `isLoadingAlbums`
- Remove album functions: `fetchAlbums`, `fetchAlbumPhotos`, `setSelectedAlbumIds`
- Remove `selectedAlbumIds` from `saveConfig` data
- Remove from return object and interface

**3. Types** (`src/types/googlePhotosSync.ts`)
- Remove `Album` interface
- Remove `selectedAlbumIds` from `SyncConfig`

**4. Config component** (`src/components/flows/google-photos-sync/GooglePhotosSyncConfig.tsx`)
- Remove `AlbumPicker` and `AlbumPhotoPreview` imports and rendering
- Remove album-related props (`albums`, `selectedAlbumIds`, `albumPhotos`, `isLoadingAlbums`, `onAlbumSelectionChange`, `onLoadAlbumPhotos`)
- Replace album picker section with a simple info card: "All photos from your Google Photos library will be synced as memories."
- Keep settings toggles (syncNewPhotos, autoCreateMemories) and Start Sync button

**5. Active component** (`src/components/flows/google-photos-sync/GooglePhotosSyncActive.tsx`)
- Remove `Album` import and `albums` prop
- Remove the "Selected Albums" / `selectedAlbumNames` section
- Replace with static text: "Syncing from: Entire library"

**6. Flow orchestrator** (`src/components/flows/google-photos-sync/GooglePhotosSyncFlow.tsx`)
- Remove album-related destructuring from `useGooglePhotosSync()`
- Remove `fetchAlbums()` call from the auth effect
- Remove album props passed to `GooglePhotosSyncConfig` and `GooglePhotosSyncActive`
- Remove `selectedAlbumIds` from `handleSaveConfig`

Files NOT changed: `AlbumPicker.tsx`, `AlbumPhotoPreview.tsx` (will become unused/dead code — can be deleted in a follow-up).

