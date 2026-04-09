export type EmailReceiptSheetPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active"
  | "needs-reconnect";

export interface EmailReceiptSheetConfig {
  id: string;
  userId: string;
  isActive: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  sheetName: string | null;
  rowsPosted: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailReceiptSheetStats {
  rowsPosted: number;
  isActive: boolean;
}

export interface SpreadsheetOption {
  id: string;
  name: string;
}

export interface ProcessedExpense {
  id: string;
  vendor: string | null;
  amount: string | null;
  dateStr: string | null;
  emailMessageId: string;
  createdAt: string;
}
