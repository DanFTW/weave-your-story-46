export type GoogleDriveAutomationPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface GoogleDriveAutomationConfig {
  id: string;
  userId: string;
  isActive: boolean;
  triggerInstanceId: string | null;
  documentsSaved: number;
  lastSyncAt: string | null;
}

export interface GoogleDriveDocStats {
  documentsSaved: number;
  isActive: boolean;
  lastSyncAt: string | null;
}
