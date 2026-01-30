export type TwitterAlphaTrackerPhase = 
  | 'auth-check'
  | 'select-account'
  | 'configure'
  | 'activating'
  | 'active';

export interface TrackedTwitterAccount {
  username: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface TrackedTwitterAccountWithStats extends TrackedTwitterAccount {
  id: string;
  postsTracked: number;
}

export interface TwitterAlphaTrackerConfig {
  id: string;
  userId: string;
  trackedUsername: string;
  trackedUserId: string;
  trackedDisplayName?: string;
  trackedAvatarUrl?: string;
  isActive: boolean;
  postsTracked: number;
  lastPolledAt: string | null;
}

export interface TwitterAlphaTrackerStats {
  totalPostsTracked: number;
  isActive: boolean;
  lastChecked: string | null;
  trackedAccounts: TrackedTwitterAccountWithStats[];
}

// Local storage types for reliable 1:1 tweet storage
export interface TwitterAlphaPost {
  id: string;
  user_id: string;
  tweet_id: string;
  author_username: string;
  author_display_name: string | null;
  tweet_text: string;
  tweet_created_at: string;
  processed_at: string;
}
