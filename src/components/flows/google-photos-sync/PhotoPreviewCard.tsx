import { PhotoItem } from "@/types/googlePhotosSync";
import { format } from "date-fns";
import { Image as ImageIcon } from "lucide-react";

interface PhotoPreviewCardProps {
  photo: PhotoItem;
}

export function PhotoPreviewCard({ photo }: PhotoPreviewCardProps) {
  const formattedDate = photo.createdAt 
    ? format(new Date(photo.createdAt), 'MMM d, yyyy')
    : 'Unknown date';

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
      {photo.baseUrl ? (
        <img
          src={`${photo.baseUrl}=w400-h400-c`}
          alt={photo.filename || 'Photo'}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      
      {/* Overlay with date */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <p className="text-[10px] text-white/90 truncate">{formattedDate}</p>
      </div>
    </div>
  );
}
