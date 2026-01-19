import { Heart, MessageSquare, Repeat2 } from "lucide-react";
import { Tweet } from "@/types/twitterSync";
import { format, parseISO } from "date-fns";

interface TweetPreviewCardProps {
  tweet: Tweet;
}

export function TweetPreviewCard({ tweet }: TweetPreviewCardProps) {
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d");
    } catch {
      return "";
    }
  };

  return (
    <div className="p-4 bg-card rounded-xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {tweet.authorUsername && (
            <span className="text-sm font-medium">@{tweet.authorUsername}</span>
          )}
          {tweet.isRetweet && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
              <Repeat2 className="w-3 h-3" />
              Retweet
            </span>
          )}
          {tweet.isReply && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Reply
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(tweet.createdAt)}
        </span>
      </div>

      {/* Tweet Text */}
      <p className="text-sm text-foreground line-clamp-3 mb-3">
        {tweet.text}
      </p>

      {/* Engagement Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {tweet.replyCount !== undefined && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {tweet.replyCount}
          </span>
        )}
        {tweet.retweetCount !== undefined && (
          <span className="flex items-center gap-1">
            <Repeat2 className="w-3.5 h-3.5" />
            {tweet.retweetCount}
          </span>
        )}
        {tweet.likeCount !== undefined && (
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            {tweet.likeCount}
          </span>
        )}
      </div>
    </div>
  );
}
