export type FacebookPagePostsPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface FacebookPagePostsConfig {
  id: string;
  userId: string;
  isActive: boolean;
  postsSynced: number;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FacebookPagePostsStats {
  postsSynced: number;
  isActive: boolean;
  lastPolledAt: string | null;
}

export interface SyncedPagePost {
  id: string;
  facebookPostId: string;
  memoryId: string | null;
  syncedAt: string | null;
}
