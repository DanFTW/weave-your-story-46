import { Music, Pause, RefreshCw, Loader2, ListMusic, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SpotifyMusicFinderStats } from "@/types/spotifyMusicFinder";
import { formatDistanceToNow } from "date-fns";

interface Props {
  stats: SpotifyMusicFinderStats;
  onPause: () => Promise<boolean>;
  onManualPoll: () => Promise<void>;
  isSyncing: boolean;
}

export function SpotifyMusicFinderActive({ stats, onPause, onManualPoll, isSyncing }: Props) {
  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">Music Discovery</h3>
              <p className="text-muted-foreground text-sm">
                {stats.isActive ? "Active" : "Paused"} · {stats.frequency}
              </p>
            </div>
          </div>
          <Switch
            checked={stats.isActive}
            onCheckedChange={(checked) => {
              if (!checked) onPause();
            }}
          />
        </div>
      </div>

      {/* Playlist info */}
      {stats.playlistName && (
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListMusic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{stats.playlistName}</p>
            <p className="text-xs text-muted-foreground">Target playlist</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Music className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{stats.songsAdded}</p>
          <p className="text-sm text-muted-foreground">Songs discovered</p>
        </div>
      </div>

      {/* Last checked */}
      {stats.lastPolledAt && (
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {formatDistanceToNow(new Date(stats.lastPolledAt), { addSuffix: true })}
            </p>
            <p className="text-xs text-muted-foreground">Last discovery</p>
          </div>
        </div>
      )}

      {/* Discover now button */}
      <button
        onClick={onManualPoll}
        disabled={isSyncing}
        className="w-full bg-card rounded-2xl border border-border p-5 flex items-center gap-4 hover:bg-accent/50 transition-colors disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RefreshCw className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground text-base">
            {isSyncing ? "Discovering…" : "Discover now"}
          </p>
          <p className="text-sm text-muted-foreground">
            Find a song based on your recent memories
          </p>
        </div>
      </button>

      {/* Pause hint */}
      <button
        onClick={onPause}
        className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground py-3"
      >
        <Pause className="w-4 h-4" />
        Pause music discovery
      </button>
    </div>
  );
}
