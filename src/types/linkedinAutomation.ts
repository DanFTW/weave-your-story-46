export type LinkedInAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface LinkedInAutomationConfig {
  id: string;
  userId: string;
  monitorNewConnections: boolean;
  isActive: boolean;
  lastPolledAt: string | null;
  connectionsTracked: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInConnectionStats {
  connectionsTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}

export interface LinkedInAutomationUpdatePayload {
  monitorNewConnections?: boolean;
  isActive?: boolean;
}
