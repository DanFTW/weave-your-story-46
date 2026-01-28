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
  postsTracked: number;
  isActive: boolean;
  lastChecked: string | null;
  trackedAccount: TrackedTwitterAccount | null;
}
