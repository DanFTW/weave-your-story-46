export type FirefliesAutomationPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface FirefliesAutomationConfig {
  id: string;
  userId: string;
  isActive: boolean;
  webhookToken: string | null;
  webhookSecret: string | null;
  transcriptsSaved: number;
  lastReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirefliesAutomationStats {
  transcriptsSaved: number;
  isActive: boolean;
  lastReceivedAt: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
}

export interface FirefliesAutomationUpdatePayload {
  isActive?: boolean;
}
