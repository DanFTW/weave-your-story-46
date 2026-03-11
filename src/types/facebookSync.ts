export type FacebookSyncPhase = 
  | 'auth-check' 
  | 'configure' 
  | 'syncing' 
  | 'active';

export interface FacebookPost {
  id: string;
  message: string;
  createdTime: string;
  permalinkUrl?: string;
  type?: string;
  statusType?: string;
}

export interface FacebookSyncConfig {
  id: string;
  userId: string;
  syncPosts: boolean;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSyncedPostId: string | null;
  postsSyncedCount: number;
  memoriesCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FacebookSyncResult {
  success: boolean;
  postsSynced: number;
  memoriesCreated: number;
  error?: string;
}
