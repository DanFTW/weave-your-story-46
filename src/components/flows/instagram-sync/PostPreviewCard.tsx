import { Image, Video, Images } from "lucide-react";
import { InstagramPost } from "@/types/instagramSync";

interface PostPreviewCardProps {
  post: InstagramPost;
}

export function PostPreviewCard({ post }: PostPreviewCardProps) {
  const getMediaIcon = () => {
    switch (post.mediaType) {
      case 'VIDEO':
        return <Video className="w-4 h-4" />;
      case 'CAROUSEL_ALBUM':
        return <Images className="w-4 h-4" />;
      default:
        return <Image className="w-4 h-4" />;
    }
  };

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
      {post.mediaUrl ? (
        <img
          src={post.mediaUrl}
          alt={post.caption || "Instagram post"}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-500/20 to-rose-500/20">
          {getMediaIcon()}
        </div>
      )}
      
      {/* Overlay with type indicator */}
      <div className="absolute top-1 right-1 p-1 rounded-md bg-black/50 text-white">
        {getMediaIcon()}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
        {post.caption && (
          <p className="text-white text-xs text-center line-clamp-3">
            {post.caption}
          </p>
        )}
      </div>
    </div>
  );
}
