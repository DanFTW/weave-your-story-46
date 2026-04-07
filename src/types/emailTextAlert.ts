export type EmailTextAlertPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface EmailTextAlertConfig {
  id: string;
  userId: string;
  isActive: boolean;
  senderFilter: string | null;
  keywordFilter: string | null;
  phoneNumber: string | null;
  alertsSent: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTextAlertStats {
  alertsSent: number;
  isActive: boolean;
}
