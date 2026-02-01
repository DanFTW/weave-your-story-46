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
  skippedDuplicates?: number;
  error?: string;
}

// Locally stored Instagram post for reliable 1:1 display
// (LIAM API tokenizes content, so we store full posts locally)
export interface InstagramStoredPost {
  id: string;
  user_id: string;
  instagram_post_id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  permalink_url: string | null;
  username: string | null;
  likes_count: number | null;
  comments_count: number | null;
  posted_at: string | null;
  synced_at: string;
}
