export type InstagramAnalyticsPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface InstagramAnalyticsConfig {
  id: string;
  userId: string;
  isActive: boolean;
  insightsCollected: number;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramAnalyticsStats {
  insightsCollected: number;
  isActive: boolean;
  lastPolledAt: string | null;
}
