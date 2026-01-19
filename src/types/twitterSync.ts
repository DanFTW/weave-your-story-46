export type TwitterSyncPhase = 
  | 'auth-check' 
  | 'configure' 
  | 'syncing' 
  | 'active';

export interface Tweet {
  id: string;
  text: string;
  authorUsername?: string;
  createdAt: string;
  retweetCount?: number;
  likeCount?: number;
  replyCount?: number;
  isRetweet?: boolean;
  isReply?: boolean;
  mediaUrl?: string;
}

export interface TwitterSyncConfig {
  id: string;
  userId: string;
  syncTweets: boolean;
  syncRetweets: boolean;
  syncReplies: boolean;
  syncLikes: boolean;
  lastSyncAt: string | null;
  lastSyncedTweetId: string | null;
  tweetsSyncedCount: number;
  memoriesCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TwitterSyncResult {
  success: boolean;
  tweetsSynced: number;
  memoriesCreated: number;
  skippedDuplicates?: number;
  error?: string;
}
