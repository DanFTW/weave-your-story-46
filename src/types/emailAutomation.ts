// Email Automation types for the combined save emails from contacts thread

export type EmailAutomationPhase = 
  | 'auth-check'      // Checking Gmail connection
  | 'contact-search'  // Search and select contacts
  | 'preferences'     // Configure incoming/outgoing per contact
  | 'activating'      // Creating Composio triggers
  | 'active'          // Monitoring is active
  | 'error';          // Error state

export interface MonitoringPreferences {
  incoming: boolean;
  outgoing: boolean;
}

export interface SelectedContact {
  email: string;
  name?: string;
  avatarUrl?: string;
  preferences: MonitoringPreferences;
}

export interface MonitoredContact {
  id: string;
  email: string;
  name?: string;
  monitorIncoming: boolean;
  monitorOutgoing: boolean;
  incomingTriggerId?: string;
  outgoingTriggerId?: string;
  isActive: boolean;
  createdAt: string;
}
