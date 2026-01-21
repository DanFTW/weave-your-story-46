export type InstagramAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface InstagramAutomationConfig {
  id: string;
  userId: string;
  monitorNewPosts: boolean;
  monitorComments: boolean;
  monitorLikes: boolean;
  isActive: boolean;
  pollIntervalMinutes: number;
  lastPolledAt: string | null;
  postsTracked: number;
  commentsTracked: number;
  likesTracked: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramEngagementStats {
  postsTracked: number;
  commentsTracked: number;
  likesTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}

export interface InstagramAutomationUpdatePayload {
  monitorNewPosts?: boolean;
  monitorComments?: boolean;
  monitorLikes?: boolean;
  pollIntervalMinutes?: number;
  isActive?: boolean;
}
