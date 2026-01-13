import { LucideIcon } from "lucide-react";

export interface LLMImportCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
  memoryTag: string;
}

export type LLMImportPhase = 'category-select' | 'configure' | 'preview' | 'success';

export interface LLMImportState {
  phase: LLMImportPhase;
  selectedCategory: LLMImportCategory | null;
  pastedContent: string;
  savedCount: number;
}
