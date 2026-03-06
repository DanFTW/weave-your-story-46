
-- Config table
CREATE TABLE public.coinbase_trades_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  trades_tracked integer NOT NULL DEFAULT 0,
  last_polled_at timestamptz,
  last_trade_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coinbase_trades_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coinbase config"
  ON public.coinbase_trades_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coinbase config"
  ON public.coinbase_trades_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own coinbase config"
  ON public.coinbase_trades_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Deduplication table
CREATE TABLE public.coinbase_processed_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  coinbase_trade_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, coinbase_trade_id)
);

ALTER TABLE public.coinbase_processed_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed trades"
  ON public.coinbase_processed_trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed trades"
  ON public.coinbase_processed_trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_coinbase_trades_config_updated_at
  BEFORE UPDATE ON public.coinbase_trades_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
