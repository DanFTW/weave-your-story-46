export type SlackMessagesSyncPhase =
  | 'auth-check'
  | 'select-channels'
  | 'configure'
  | 'activating'
  | 'active';

export interface SlackChannel {
  id: string;
  name: string;
  isMember: boolean;
  isPrivate: boolean;
  numMembers?: number;
}

export interface SlackMessagesSyncConfig {
  id: string;
  userId: string;
  isActive: boolean;
  searchMode: boolean;
  selectedChannelIds: string[];
  messagesImported: number;
  lastPolledAt: string | null;
}

export interface SlackMessagesSyncStats {
  messagesImported: number;
  lastPolled: string | null;
  isActive: boolean;
  searchMode: boolean;
}
