export type GrocerySheetSyncPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface GrocerySheetSyncConfig {
  id: string;
  userId: string;
  isActive: boolean;
  spreadsheetId: string | null;
  spreadsheetName: string | null;
  sheetName: string | null;
  itemsPosted: number;
  createdAt: string;
  updatedAt: string;
}

export interface GrocerySheetSyncStats {
  itemsPosted: number;
  isActive: boolean;
}

export interface SpreadsheetOption {
  id: string;
  name: string;
}
