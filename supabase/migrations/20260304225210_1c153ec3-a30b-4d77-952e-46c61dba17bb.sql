
-- Grocery Sheet Config table
CREATE TABLE public.grocery_sheet_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  spreadsheet_id text,
  spreadsheet_name text,
  sheet_name text DEFAULT 'Sheet1',
  items_posted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_sheet_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own grocery config"
  ON public.grocery_sheet_config FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grocery config"
  ON public.grocery_sheet_config FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery config"
  ON public.grocery_sheet_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grocery Sheet Processed Memories table
CREATE TABLE public.grocery_sheet_processed_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  memory_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, memory_id)
);

ALTER TABLE public.grocery_sheet_processed_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed grocery memories"
  ON public.grocery_sheet_processed_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed grocery memories"
  ON public.grocery_sheet_processed_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger to grocery_sheet_config
CREATE TRIGGER update_grocery_sheet_config_updated_at
  BEFORE UPDATE ON public.grocery_sheet_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
