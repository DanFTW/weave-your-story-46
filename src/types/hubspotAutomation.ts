export type HubSpotAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface HubSpotAutomationConfig {
  id: string;
  userId: string;
  monitorNewContacts: boolean;
  isActive: boolean;
  triggerId: string | null;
  contactsTracked: number;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HubSpotContactStats {
  contactsTracked: number;
  lastChecked: string | null;
  isActive: boolean;
}

export interface HubSpotAutomationUpdatePayload {
  monitorNewContacts?: boolean;
  isActive?: boolean;
}
