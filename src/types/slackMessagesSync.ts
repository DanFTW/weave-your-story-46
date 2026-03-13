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
  isDm?: boolean;
  numMembers?: number;
}

export interface SlackMessagesSyncConfig {
  id: string;
  userId: string;
  isActive: boolean;
  selectedChannelIds: string[];
  selectedChannelNames: string[];
  messagesImported: number;
  lastPolledAt: string | null;
}

export interface SlackMessagesSyncStats {
  messagesImported: number;
  lastPolled: string | null;
  isActive: boolean;
  channelNames: string[];
}

export interface SlackRecentMessage {
  id: string;
  slackMessageId: string;
  messageContent: string | null;
  authorName: string | null;
  createdAt: string;
}
