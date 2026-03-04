export type RestaurantBookmarkSyncPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface RestaurantBookmarkSyncConfig {
  id: string;
  userId: string;
  isActive: boolean;
  restaurantsBookmarked: number;
  createdAt: string;
  updatedAt: string;
}

export interface PendingRestaurantBookmark {
  id: string;
  userId: string;
  memoryId: string;
  memoryContent: string;
  restaurantName: string | null;
  restaurantAddress: string | null;
  restaurantCuisine: string | null;
  restaurantNotes: string | null;
  placeId: string | null;
  googleMapsUrl: string | null;
  status: "pending" | "completed" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantBookmarkSyncStats {
  restaurantsBookmarked: number;
  isActive: boolean;
  pendingCount: number;
}
