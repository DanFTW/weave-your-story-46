export type WeeklyEventFinderPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface WeeklyEventFinderConfig {
  id: string;
  userId: string;
  isActive: boolean;
  interests: string | null;
  location: string | null;
  frequency: "weekly" | "daily";
  deliveryMethod: "email" | "text";
  email: string | null;
  phoneNumber: string | null;
  eventsFound: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyEventFinderStats {
  eventsFound: number;
  isActive: boolean;
}

export interface FoundEvent {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string | null;
  eventDescription: string | null;
  eventReason: string | null;
  eventLink: string | null;
  processedAt: string;
}
