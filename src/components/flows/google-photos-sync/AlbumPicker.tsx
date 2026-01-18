import { useState } from "react";
import { FolderOpen, Check, Loader2, ImageIcon, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Album } from "@/types/googlePhotosSync";
import { cn } from "@/lib/utils";

interface AlbumPickerProps {
  albums: Album[];
  selectedAlbumIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
}

export function AlbumPicker({
  albums,
  selectedAlbumIds,
  onSelectionChange,
  isLoading = false,
}: AlbumPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAlbums = albums.filter(album =>
    album.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleAlbum = (albumId: string) => {
    if (selectedAlbumIds.includes(albumId)) {
      onSelectionChange(selectedAlbumIds.filter(id => id !== albumId));
    } else {
      onSelectionChange([...selectedAlbumIds, albumId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(albums.map(a => a.id));
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading albums...</p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">No albums found</p>
          <p className="text-sm text-muted-foreground">
            Create albums in Google Photos to sync specific collections
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Select Albums to Sync</Label>
        <div className="flex gap-2 text-xs">
          <button 
            onClick={selectAll}
            className="text-primary hover:underline"
          >
            Select all
          </button>
          <span className="text-muted-foreground">|</span>
          <button 
            onClick={clearAll}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search albums..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      {/* Selection info */}
      {selectedAlbumIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedAlbumIds.length} album{selectedAlbumIds.length !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Albums grid */}
      <ScrollArea className="h-[320px] -mx-1 px-1">
        <div className="grid grid-cols-2 gap-3">
          {/* "All Photos" option */}
          <div
            onClick={() => clearAll()}
            className={cn(
              "rounded-xl border p-3 cursor-pointer transition-all",
              selectedAlbumIds.length === 0
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-teal-500" />
            </div>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                selectedAlbumIds.length === 0 
                  ? "bg-primary border-primary" 
                  : "border-muted-foreground/50"
              )}>
                {selectedAlbumIds.length === 0 && (
                  <Check className="w-3 h-3 text-primary-foreground" />
                )}
              </div>
              <span className="text-sm font-medium truncate">All Photos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sync entire library</p>
          </div>

          {/* Album cards */}
          {filteredAlbums.map((album) => {
            const isSelected = selectedAlbumIds.includes(album.id);
            
            return (
              <div
                key={album.id}
                onClick={() => toggleAlbum(album.id)}
                className={cn(
                  "rounded-xl border p-3 cursor-pointer transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                {/* Album cover */}
                <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-muted">
                  {album.coverPhotoBaseUrl ? (
                    <img
                      src={`${album.coverPhotoBaseUrl}=w200-h200-c`}
                      alt={album.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Album info */}
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                    isSelected 
                      ? "bg-primary border-primary" 
                      : "border-muted-foreground/50"
                  )}>
                    {isSelected && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium truncate">{album.title}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {album.mediaItemsCount || 0} photos
                </p>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
