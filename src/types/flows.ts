import { LucideIcon } from "lucide-react";
import { ThreadGradient } from "./threads";

// Field types supported in flow forms
export type FlowFieldType = 'text' | 'textarea' | 'date' | 'select' | 'chips' | 'multitext' | 'image';

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
  isReceiptFlow?: boolean; // If true, uses receipt scanning UI
  isLLMImportFlow?: boolean; // If true, uses LLM import UI
  isEmailDumpFlow?: boolean; // If true, uses email dump UI
  isEmailAutomationFlow?: boolean; // If true, uses email automation UI
  isGooglePhotosSyncFlow?: boolean; // If true, uses Google Photos sync UI
}

// Single data entry (e.g., one family member)
export interface FlowEntry {
  id: string;
  data: Record<string, string>;
  createdAt: string;
  imageUrl?: string; // For receipt/image entries
  imageBase64?: string; // Temporary base64 storage
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
