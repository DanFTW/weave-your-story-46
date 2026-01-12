import { LucideIcon } from "lucide-react";
import { ThreadGradient } from "./threads";

// Field types supported in flow forms
export type FlowFieldType = 'text' | 'textarea' | 'date' | 'select' | 'chips' | 'multitext';

// Single form field definition
export interface FlowField {
  id: string;
  label: string;
  placeholder: string;
  type: FlowFieldType;
  required: boolean;
  options?: string[]; // For select/chips type
  section?: string; // Optional section header
  hint?: string; // Optional helper text
}

// Flow configuration - defines any memory collection flow
export interface FlowConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: ThreadGradient;
  icon: LucideIcon;
  entryName: string; // "family member", "cuisine", etc.
  entryNamePlural: string;
  fields: FlowField[];
  memoryTag: string; // Tag for generated memories
  singleEntry?: boolean; // If true, only one entry (like food preferences)
}

// Single data entry (e.g., one family member)
export interface FlowEntry {
  id: string;
  data: Record<string, string>;
  createdAt: string;
}

// AI-generated memory with edit/delete state
export interface GeneratedMemory {
  id: string;
  content: string;
  tag: string;
  entryId: string;
  entryName: string;
  isDeleted?: boolean;
  isEditing?: boolean;
}

// Flow phase states
export type FlowPhase = 
  | 'overview'    // Initial view with add card
  | 'adding'      // Form for new entry
  | 'editing'     // Form for existing entry
  | 'list'        // List of entries before generation
  | 'generating'  // AI processing
  | 'preview'     // Review generated memories
  | 'configured'; // Final view with all entries

// Complete flow state
export interface FlowState {
  phase: FlowPhase;
  entries: FlowEntry[];
  editingEntryId: string | null;
  generatedMemories: GeneratedMemory[];
  savedMemoryIds: string[];
}
