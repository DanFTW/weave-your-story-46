import { LucideIcon } from "lucide-react";
import { ThreadGradient } from "./threads";

export type StepType = "setup" | "integration" | "save";

export interface ThreadStep {
  id: string;
  type: StepType;
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconUrl?: string;
  badge?: string;
}

export interface ThreadConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: ThreadGradient;
  icon: LucideIcon;
  steps: ThreadStep[];
}
