export type EmailDumpPhase = 
  | 'auth-check'
  | 'contact-search'
  | 'extracting'
  | 'preview'
  | 'success';

export interface Contact {
  email: string;
  name?: string;
  avatarUrl?: string;
  messageCount?: number;
}

export interface ExtractedEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  threadId?: string;
}

export interface EmailMemory {
  id: string;
  content: string;
  tag: string;
  email: ExtractedEmail;
  isEditing?: boolean;
}
