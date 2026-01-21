export type TwitterAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface TwitterAutomationConfig {
  id: string;
  userId: string;
  monitorNewPosts: boolean;
  monitorReplies: boolean;
  monitorRetweets: boolean;
  monitorLikes: boolean;
  isActive: boolean;
  lastPolledAt: string | null;
  postsTracked: number;
  repliesTracked: number;
  retweetsTracked: number;
  likesTracked: number;
  createdAt: string;
  updatedAt: string;
}

export interface TwitterEngagementStats {
  postsTracked: number;
  repliesTracked: number;
  retweetsTracked: number;
  likesTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}

export interface TwitterAutomationUpdatePayload {
  monitorNewPosts?: boolean;
  monitorReplies?: boolean;
  monitorRetweets?: boolean;
  monitorLikes?: boolean;
  isActive?: boolean;
}
