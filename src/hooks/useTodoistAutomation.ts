import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  TodoistAutomationPhase, 
  TodoistAutomationConfig,
  TodoistTaskStats,
  TodoistAutomationUpdatePayload
} from "@/types/todoistAutomation";

export function useTodoistAutomation() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<TodoistAutomationPhase>('auth-check');
  const [config, setConfig] = useState<TodoistAutomationConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  const stats: TodoistTaskStats = {
    tasksTracked: config?.tasksTracked ?? 0,
    isActive: config?.isActive ?? false,
  };

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPhase('auth-check'); return; }

      const { data, error } = await supabase
        .from('todoist_automation_config' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading todoist config:', error);
        toast({ title: "Error loading config", description: error.message, variant: "destructive" });
        return;
      }

      if (data) {
        const d = data as any;
        setConfig({
          id: d.id, userId: d.user_id, monitorNewTasks: d.monitor_new_tasks,
          isActive: d.is_active, triggerId: d.trigger_id, tasksTracked: d.tasks_tracked ?? 0,
          createdAt: d.created_at, updatedAt: d.updated_at,
        });
        setPhase(d.is_active ? 'active' : 'configure');
      } else {
        const { data: newConfig, error: insertError } = await supabase
          .from('todoist_automation_config' as any)
          .insert({ user_id: user.id, monitor_new_tasks: true, is_active: false })
          .select()
          .single();

        if (insertError) { console.error('Error creating config:', insertError); return; }

        const n = newConfig as any;
        setConfig({
          id: n.id, userId: n.user_id, monitorNewTasks: n.monitor_new_tasks,
          isActive: n.is_active, triggerId: n.trigger_id, tasksTracked: n.tasks_tracked ?? 0,
          createdAt: n.created_at, updatedAt: n.updated_at,
        });
        setPhase('configure');
      }
    } catch (err) {
      console.error('Error in loadConfig:', err);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateConfig = useCallback(async (updates: TodoistAutomationUpdatePayload): Promise<boolean> => {
    if (!config) return false;
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.monitorNewTasks !== undefined) dbUpdates.monitor_new_tasks = updates.monitorNewTasks;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

      const { error } = await supabase
        .from('todoist_automation_config' as any)
        .update(dbUpdates)
        .eq('id', config.id);

      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return false;
      }
      setConfig(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (err) {
      console.error('Error updating config:', err);
      return false;
    }
  }, [config, toast]);

  const activateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Authentication required", description: "Please log in to activate monitoring", variant: "destructive" });
        return false;
      }

      const { data, error } = await supabase.functions.invoke('todoist-automation-triggers', {
        body: { action: 'activate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Activation failed", description: error.message, variant: "destructive" });
        return false;
      }

      await updateConfig({ isActive: true });
      setPhase('active');
      toast({ title: "Monitoring activated", description: "Your Todoist tasks will be tracked automatically" });
      return true;
    } catch (err) {
      console.error('Error activating monitoring:', err);
      toast({ title: "Activation failed", description: "An unexpected error occurred", variant: "destructive" });
      return false;
    } finally {
      setIsActivating(false);
    }
  }, [config, updateConfig, toast]);

  const deactivateMonitoring = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { error } = await supabase.functions.invoke('todoist-automation-triggers', {
        body: { action: 'deactivate' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Deactivation failed", description: error.message, variant: "destructive" });
        return false;
      }

      await updateConfig({ isActive: false });
      setPhase('configure');
      toast({ title: "Monitoring paused", description: "Automatic tracking has been stopped" });
      return true;
    } catch (err) {
      console.error('Error deactivating:', err);
      return false;
    }
  }, [config, updateConfig, toast]);

  const manualPoll = useCallback(async (): Promise<boolean> => {
    if (!config) return false;
    setIsPolling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke('todoist-automation-triggers', {
        body: { action: 'manual-poll' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        toast({ title: "Check failed", description: error.message, variant: "destructive" });
        return false;
      }

      const newItems = data?.newItems ?? 0;
      if (newItems > 0) {
        toast({ title: `Found ${newItems} new task${newItems > 1 ? 's' : ''}`, description: "Memories have been created" });
        await loadConfig(); // Refresh stats
      } else {
        toast({ title: "No new tasks", description: "All tasks are already tracked" });
      }
      return true;
    } catch (err) {
      console.error('Error polling:', err);
      return false;
    } finally {
      setIsPolling(false);
    }
  }, [config, toast, loadConfig]);

  const reset = useCallback(() => {
    setPhase('auth-check');
    setConfig(null);
  }, []);

  return {
    phase, setPhase, config, stats, isLoading, isActivating, isPolling,
    loadConfig, updateConfig, activateMonitoring, deactivateMonitoring, manualPoll, reset,
  };
}
