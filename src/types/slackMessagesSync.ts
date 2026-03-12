export type SlackMessagesSyncPhase =
  | 'auth-check'
  | 'select-channels'
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
