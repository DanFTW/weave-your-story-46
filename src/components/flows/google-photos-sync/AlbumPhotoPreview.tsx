import { useEffect, useState } from "react";
import { Loader2, ImageIcon } from "lucide-react";
import { PhotoItem, Album } from "@/types/googlePhotosSync";
import { PhotoPreviewCard } from "./PhotoPreviewCard";
import { Button } from "@/components/ui/button";

interface AlbumPhotoPreviewProps {
  selectedAlbumIds: string[];
  albums: Album[];
  albumPhotos: Record<string, PhotoItem[]>;
  onLoadAlbumPhotos: (albumId: string) => Promise<PhotoItem[]>;
}

export function AlbumPhotoPreview({
  selectedAlbumIds,
  albums,
  albumPhotos,
  onLoadAlbumPhotos,
}: AlbumPhotoPreviewProps) {
  const [loadingAlbums, setLoadingAlbums] = useState<Set<string>>(new Set());
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);

  // Load photos for selected albums that haven't been loaded yet
  useEffect(() => {
    const loadPhotos = async () => {
      for (const albumId of selectedAlbumIds) {
        if (!albumPhotos[albumId] && !loadingAlbums.has(albumId)) {
          setLoadingAlbums(prev => new Set(prev).add(albumId));
          await onLoadAlbumPhotos(albumId);
          setLoadingAlbums(prev => {
            const next = new Set(prev);
            next.delete(albumId);
            return next;
          });
        }
      }
    };
    
    if (selectedAlbumIds.length > 0) {
      loadPhotos();
    }
  }, [selectedAlbumIds, albumPhotos, onLoadAlbumPhotos, loadingAlbums]);

  if (selectedAlbumIds.length === 0) {
    return null;
  }

  // Get selected albums info
  const selectedAlbums = albums.filter(a => selectedAlbumIds.includes(a.id));

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-foreground">Preview Photos</h4>
      
      {selectedAlbums.map((album) => {
        const photos = albumPhotos[album.id] || [];
        const isLoading = loadingAlbums.has(album.id);
        const isExpanded = expandedAlbumId === album.id;
        const displayPhotos = isExpanded ? photos : photos.slice(0, 6);

        return (
          <div key={album.id} className="space-y-2">
            {/* Album header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {album.title}
              </span>
              {photos.length > 6 && (
                <button
                  onClick={() => setExpandedAlbumId(isExpanded ? null : album.id)}
                  className="text-xs text-primary hover:underline"
                >
                  {isExpanded ? 'Show less' : `Show all ${photos.length}`}
                </button>
              )}
            </div>

            {/* Photos grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {displayPhotos.map((photo) => (
                  <PhotoPreviewCard key={photo.id} photo={photo} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">No photos in this album</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
