import { Play, Eye, ThumbsUp } from "lucide-react";
import type { YouTubeVideo } from "@/types/youtubeSync";

interface VideoPreviewCardProps {
  video: YouTubeVideo;
}

export function VideoPreviewCard({ video }: VideoPreviewCardProps) {
  const formatNumber = (num?: number) => {
    if (!num) return null;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="font-medium text-sm line-clamp-2 leading-tight mb-1">
          {video.title}
        </h4>
        
        {video.channelTitle && (
          <p className="text-xs text-muted-foreground mb-2">
            {video.channelTitle}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {video.viewCount && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatNumber(video.viewCount)}
            </span>
          )}
          {video.likeCount && (
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3 h-3" />
              {formatNumber(video.likeCount)}
            </span>
          )}
          <span>{formatDate(video.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}
