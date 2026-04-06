import { useState, useEffect } from "react";
import { Music, ArrowRight, Loader2 } from "lucide-react";
import { SpotifyMusicFinderConfig as ConfigType, SpotifyPlaylist } from "@/types/spotifyMusicFinder";

interface Props {
  config: ConfigType;
  playlists: SpotifyPlaylist[];
  isLoadingPlaylists: boolean;
  onLoadPlaylists: () => Promise<void>;
  onActivate: (playlistId: string, playlistName: string, frequency: "daily" | "weekly") => Promise<void>;
  isActivating: boolean;
}

export function SpotifyMusicFinderConfig({
  config,
  playlists,
  isLoadingPlaylists,
  onLoadPlaylists,
  onActivate,
  isActivating,
}: Props) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(config.playlistId || "");
  const [frequency, setFrequency] = useState<"daily" | "weekly">(config.frequency || "daily");

  useEffect(() => {
    onLoadPlaylists();
  }, [onLoadPlaylists]);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
  const canActivate = !!selectedPlaylistId;

  const handleActivate = () => {
    if (!selectedPlaylist) return;
    onActivate(selectedPlaylist.id, selectedPlaylist.name, frequency);
  };

  return (
    <div className="space-y-6">
      {/* Explanation card */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">How it works</h3>
            <p className="text-muted-foreground text-sm">Memories → Music discovery</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            "We analyze your recent memories for mood, themes, and moments",
            "An AI finds a matching song that fits your current context",
            "The song is automatically added to your chosen Spotify playlist",
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Playlist selector */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-base">Select playlist</h3>
        {isLoadingPlaylists ? (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading playlists…</span>
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No playlists found. Create one in Spotify first.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setSelectedPlaylistId(playlist.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                  selectedPlaylistId === playlist.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-accent/50 border border-transparent"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {playlist.imageUrl ? (
                    <img src={playlist.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">{playlist.trackCount} tracks</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Frequency selector */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-base">Frequency</h3>
        <div className="flex gap-2">
          {(["daily", "weekly"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                frequency === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {f === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>
      </div>

      {/* Activate button */}
      <button
        onClick={handleActivate}
        disabled={isActivating || !canActivate}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
      >
        {isActivating ? (
          <span className="animate-pulse">Activating...</span>
        ) : (
          <>
            Start Music Discovery
            <ArrowRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
