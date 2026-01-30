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
  extensionLastEventAt: string | null;
  extensionEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedInConnectionStats {
  connectionsTracked: number;
  lastChecked: string | null;
  isActive: boolean;
  extensionLastEventAt: string | null;
  extensionEnabled: boolean;
}

export interface LinkedInAutomationUpdatePayload {
  monitorNewConnections?: boolean;
  isActive?: boolean;
  extensionEnabled?: boolean;
}
