export type DiscordAutomationPhase = 
  | 'auth-check'
  | 'select-server'
  | 'select-channel'
  | 'configure'
  | 'activating'
  | 'active';

export interface DiscordServer {
  id: string;
  name: string;
  icon?: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

export interface DiscordAutomationConfig {
  id: string;
  userId: string;
  serverId: string | null;
  serverName: string | null;
  channelId: string | null;
  channelName: string | null;
  isActive: boolean;
  triggerInstanceId: string | null;
  connectedAccountId: string | null;
  messagesTracked: number;
  lastCheckedAt: string | null;
  triggerWord: string;
  triggerWordEnabled: boolean;
}

export interface DiscordAutomationStats {
  messagesTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}

export interface DiscordRecentMessage {
  id: string;
  discordMessageId: string;
  messageContent: string | null;
  authorName: string | null;
  createdAt: string;
}
