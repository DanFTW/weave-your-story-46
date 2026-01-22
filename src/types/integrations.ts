export type IntegrationStatus = 'connected' | 'unconfigured' | 'approved' | 'none' | 'coming-soon';

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

export interface IntegrationDetail extends Integration {
  description: string;
  capabilities: string[];
  gradientColors: {
    primary: string;
    secondary: string;
    tertiary?: string;
    quaternary?: string;
  };
  /** Whether the provider supports programmatic account switching via forceReauth. Default: true */
  supportsAccountSwitch?: boolean;
  /** URL to provider's logout page for manual account switching */
  logoutUrl?: string;
}
