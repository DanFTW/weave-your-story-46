export type GooglePhotosSyncPhase = 
  | 'auth-check' 
  | 'configure' 
  | 'syncing' 
  | 'active';

export interface Album {
  id: string;
  title: string;
  mediaItemsCount?: number;
  coverPhotoBaseUrl?: string;
  productUrl?: string;
}

export interface SyncConfig {
  id: string;
  userId: string;
  syncNewPhotos: boolean;
  autoCreateMemories: boolean;
  lastSyncAt: string | null;
  lastSyncedPhotoId: string | null;
  photosSyncedCount: number;
  memoriesCreatedCount: number;
  createdAt: string;
  updatedAt: string;
  selectedAlbumIds: string[] | null;
}

export interface PhotoItem {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
  width?: number;
  height?: number;
  baseUrl?: string;
  productUrl?: string;
  description?: string;
}

export interface SyncResult {
  success: boolean;
  photosSynced: number;
  memoriesCreated: number;
  newLastSyncedPhotoId?: string;
  error?: string;
}
