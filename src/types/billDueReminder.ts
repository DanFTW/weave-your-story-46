export type BillDueReminderPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface BillDueReminderConfig {
  id: string;
  userId: string;
  isActive: boolean;
  billsFound: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillDueReminderStats {
  billsFound: number;
  isActive: boolean;
}

export interface ProcessedBill {
  id: string;
  emailMessageId: string;
  billerName: string | null;
  amountDue: string | null;
  dueDate: string | null;
  subject: string | null;
  createdAt: string;
}
