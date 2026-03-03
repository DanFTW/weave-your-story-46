export type BirthdayReminderPhase =
  | 'auth-check'
  | 'configure'
  | 'activating'
  | 'active'
  | 'confirming';

export interface BirthdayReminderConfig {
  id: string;
  userId: string;
  isActive: boolean;
  remindersSent: number;
  lastCheckedAt: string | null;
  daysBefore: number;
  createdAt: string;
  updatedAt: string;
}

export interface BirthdayReminderStats {
  remindersSent: number;
  lastChecked: string | null;
  isActive: boolean;
  daysBefore: number;
}

export interface SentReminder {
  id: string;
  personName: string;
  birthdayDate: string;
  yearSent: number;
  sentAt: string;
}

export interface ScannedBirthdayPerson {
  personName: string;
  birthdayDate: string;
  email: string | null;
  contextMemories: string[];
  alreadySent: boolean;
}
