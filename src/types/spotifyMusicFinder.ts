export type SpotifyMusicFinderPhase =
  | "auth-check"
  | "configure"
  | "activating"
  | "active";

export interface SpotifyMusicFinderConfig {
  id: string;
  userId: string;
  playlistId: string | null;
  playlistName: string | null;
  frequency: "daily" | "weekly";
  isActive: boolean;
  songsAdded: number;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl?: string;
  trackCount: number;
}

export interface SpotifyMusicFinderStats {
  songsAdded: number;
  isActive: boolean;
  frequency: "daily" | "weekly";
  playlistName: string | null;
  lastPolledAt: string | null;
}
