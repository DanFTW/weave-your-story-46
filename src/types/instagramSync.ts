export type InstagramSyncPhase = 
  | 'auth-check' 
  | 'configure' 
  | 'syncing' 
  | 'active';

export interface InstagramPost {
  id: string;
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl?: string;
  permalinkUrl?: string;
  timestamp: string;
  username?: string;
  likesCount?: number;
  commentsCount?: number;
}

export interface InstagramComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
  likeCount?: number;
  mediaId: string;
}

export interface InstagramSyncConfig {
  id: string;
  userId: string;
  syncPosts: boolean;
  syncComments: boolean;
  lastSyncAt: string | null;
  lastSyncedPostId: string | null;
  postsSyncedCount: number;
  memoriesCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramSyncResult {
  success: boolean;
  postsSynced: number;
  commentsSynced: number;
  memoriesCreated: number;
  error?: string;
}
