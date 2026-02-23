export interface Memory {
  id: string;
  content: string;
  tag?: string;
  createdAt: string;
  category?: string;
  sensitivity?: string;
  /** IDs of all fragments that were merged into this memory (for consolidated memories) */
  _fragmentIds?: string[];
  /** Base64-encoded image data from LIAM API (for memories created with images) */
  imageDataBase64?: string | null;
  /** MIME type of the stored image (e.g., "image/jpeg") */
  imageMimeType?: string | null;
}

export interface MemoryCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  color: string;
}

export interface SharedMemoryItem {
  shareId: string;
  shareToken: string;
  memoryId: string;
  shareScope: 'single' | 'thread' | 'custom';
  customCondition: string | null;
  threadTag: string | null;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memoryTag: string | null;
  visibility: 'anyone' | 'recipients_only';
  sharedAt: string;
  viewedAt: string | null;
}

export interface GroupedMemories {
  date: string;
  label: string;
  memories: Memory[];
}
