import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SyncedPagePost } from "@/types/facebookPagePosts";

interface PagePostCardProps {
  post: SyncedPagePost;
}

export function PagePostCard({ post }: PagePostCardProps) {
  const facebookUrl = `https://www.facebook.com/${post.facebookPostId.replace('_', '/posts/')}`;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground line-clamp-2">
            Post ID: {post.facebookPostId}
          </p>
          {post.syncedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Synced {formatDistanceToNow(new Date(post.syncedAt), { addSuffix: true })}
            </p>
          )}
        </div>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}
