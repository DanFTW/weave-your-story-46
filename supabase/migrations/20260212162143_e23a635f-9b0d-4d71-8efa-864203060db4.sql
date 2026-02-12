
-- Create todoist_automation_config table
CREATE TABLE public.todoist_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monitor_new_tasks BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT false,
  trigger_id TEXT,
  tasks_tracked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.todoist_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own todoist config"
  ON public.todoist_automation_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todoist config"
  ON public.todoist_automation_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todoist config"
  ON public.todoist_automation_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_todoist_automation_config_updated_at
  BEFORE UPDATE ON public.todoist_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create todoist_processed_tasks table
CREATE TABLE public.todoist_processed_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  todoist_task_id TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, todoist_task_id)
);

ALTER TABLE public.todoist_processed_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed tasks"
  ON public.todoist_processed_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own processed tasks"
  ON public.todoist_processed_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
