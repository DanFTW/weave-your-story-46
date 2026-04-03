export type PurchaseTrackerPhase =
  | 'auth-check'
  | 'scanning'
  | 'preview'
  | 'success';

export interface Purchase {
  messageId: string;
  vendor: string;
  amount: string;
  date: string;
  subject: string;
}

export interface PurchaseMemory {
  id: string;
  content: string;
  tag: string;
  purchase: Purchase;
  isEditing?: boolean;
}
