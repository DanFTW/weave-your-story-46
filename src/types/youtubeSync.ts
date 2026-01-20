export type YouTubeSyncPhase = 
  | 'auth-check' 
  | 'configure' 
  | 'syncing' 
  | 'active';

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle?: string;
  description?: string;
  publishedAt: string;
  thumbnailUrl?: string;
  viewCount?: number;
  likeCount?: number;
}

export interface YouTubeSyncConfig {
  id: string;
  userId: string;
  syncLikedVideos: boolean;
  syncWatchHistory: boolean;
  syncSubscriptions: boolean;
  lastSyncAt: string | null;
  lastSyncedVideoId: string | null;
  videosSyncedCount: number;
  memoriesCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface YouTubeSyncResult {
  success: boolean;
  videosSynced: number;
  memoriesCreated: number;
  error?: string;
}
