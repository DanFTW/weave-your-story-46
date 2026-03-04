export type CalendarEventSyncPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface CalendarEventSyncConfig {
  id: string;
  userId: string;
  isActive: boolean;
  eventsCreated: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingCalendarEvent {
  id: string;
  userId: string;
  memoryId: string;
  memoryContent: string;
  eventTitle: string | null;
  eventDate: string | null;
  eventTime: string | null;
  eventDescription: string | null;
  status: "pending" | "completed" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventSyncStats {
  eventsCreated: number;
  isActive: boolean;
  pendingCount: number;
}
