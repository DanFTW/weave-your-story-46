export type SlackMessagesSyncPhase =
  | 'auth-check'
  | 'select-workspace'
  | 'select-channels'
  | 'activating'
  | 'active'
  | 'needs-reconnect';

export interface SlackWorkspace {
  id: string;
  name: string;
  icon?: string;
}

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
  selectedChannelId: string | null;
  selectedChannelName: string | null;
  messagesImported: number;
  lastPolledAt: string | null;
}

export interface SlackMessagesSyncStats {
  messagesImported: number;
  lastPolled: string | null;
  isActive: boolean;
  channelName: string | null;
}
