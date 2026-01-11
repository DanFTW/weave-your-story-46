import { LucideIcon } from "lucide-react";

export type ThreadGradient = "blue" | "teal" | "purple" | "orange" | "pink";

export type ThreadStatus = "setup" | "active" | "try";

export type ThreadType = "automation" | "flow";

export interface Thread {
  id: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  gradient: ThreadGradient;
  status: ThreadStatus;
  type: ThreadType;
  category?: string;
}

export interface ThreadCategory {
  id: string;
  name: string;
  threads: Thread[];
}
