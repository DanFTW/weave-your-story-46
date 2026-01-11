export interface Memory {
  id: string;
  content: string;
  tag?: string;
  createdAt: string;
  category?: string;
  sensitivity?: string;
}

export interface MemoryCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  color: string;
}

export interface GroupedMemories {
  date: string;
  label: string;
  memories: Memory[];
}
