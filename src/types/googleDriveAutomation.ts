export type GoogleDriveAutomationPhase =
  | 'auth-check'
  | 'ready'
  | 'activating';

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

export interface GoogleDriveSearchResult {
  id: string;
  name: string;
  createdTime: string;
  webViewLink: string;
  alreadySaved: boolean;
}
