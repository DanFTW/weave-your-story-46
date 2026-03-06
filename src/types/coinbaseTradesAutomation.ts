export type CoinbaseTradesPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface CoinbaseTradesConfig {
  id: string;
  userId: string;
  isActive: boolean;
  tradesTracked: number;
  lastPolledAt: string | null;
  lastTradeTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoinbaseTradesStats {
  tradesTracked: number;
  isActive: boolean;
  lastPolledAt: string | null;
}

export interface CoinbaseTradesUpdatePayload {
  isActive?: boolean;
}
