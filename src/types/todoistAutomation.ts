export type TodoistAutomationPhase = 
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active';

export interface TodoistAutomationConfig {
  id: string;
  userId: string;
  monitorNewTasks: boolean;
  isActive: boolean;
  triggerId: string | null;
  tasksTracked: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoistTaskStats {
  tasksTracked: number;
  isActive: boolean;
}

export interface TodoistAutomationUpdatePayload {
  monitorNewTasks?: boolean;
  isActive?: boolean;
}
