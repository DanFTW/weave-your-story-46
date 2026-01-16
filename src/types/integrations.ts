export type IntegrationStatus = 'connected' | 'unconfigured' | 'approved' | 'none';

export interface Integration {
  id: string;
  name: string;
  icon: string;
  status: IntegrationStatus;
  subtitle?: string;
}

export interface IntegrationSection {
  title: string;
  integrations: Integration[];
}
