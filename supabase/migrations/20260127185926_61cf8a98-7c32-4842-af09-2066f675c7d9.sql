-- Store Trello automation configuration per user
CREATE TABLE IF NOT EXISTS public.trello_automation_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  board_id TEXT,
  board_name TEXT,
  done_list_id TEXT,
  done_list_name TEXT,
  monitor_new_cards BOOLEAN DEFAULT true,
  monitor_completed_cards BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  new_card_trigger_id TEXT,
  updated_card_trigger_id TEXT,
  cards_tracked INTEGER DEFAULT 0,
  completed_tracked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Track processed cards to avoid duplicates
CREATE TABLE IF NOT EXISTS public.trello_processed_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  card_type TEXT NOT NULL,
  trello_card_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_type, trello_card_id)
);

-- Enable RLS
ALTER TABLE public.trello_automation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trello_processed_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for trello_automation_config
CREATE POLICY "Users can view their own Trello config"
  ON public.trello_automation_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Trello config"
  ON public.trello_automation_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Trello config"
  ON public.trello_automation_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Trello config"
  ON public.trello_automation_config
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for trello_processed_cards
CREATE POLICY "Users can view their own processed cards"
  ON public.trello_processed_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed cards"
  ON public.trello_processed_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own processed cards"
  ON public.trello_processed_cards
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_trello_automation_config_updated_at
  BEFORE UPDATE ON public.trello_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();