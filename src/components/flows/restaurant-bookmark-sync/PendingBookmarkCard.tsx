import { useState } from "react";
import { ChevronDown, ChevronUp, X, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PendingRestaurantBookmark } from "@/types/restaurantBookmarkSync";

interface PendingBookmarkCardProps {
  bookmark: PendingRestaurantBookmark;
  onUpdate: (bookmarkId: string, fields: { restaurantName?: string; restaurantAddress?: string; restaurantCuisine?: string; restaurantNotes?: string }) => Promise<void>;
  onPush: (bookmarkId: string) => Promise<boolean>;
  onDismiss: (bookmarkId: string) => Promise<void>;
  isPushing: boolean;
}

export function PendingBookmarkCard({ bookmark, onUpdate, onPush, onDismiss, isPushing }: PendingBookmarkCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(bookmark.restaurantName ?? "");
  const [address, setAddress] = useState(bookmark.restaurantAddress ?? "");
  const [cuisine, setCuisine] = useState(bookmark.restaurantCuisine ?? "");
  const [notes, setNotes] = useState(bookmark.restaurantNotes ?? "");

  const isComplete = name.trim().length > 0 && address.trim().length > 0;

  const handleSaveAndPush = async () => {
    await onUpdate(bookmark.id, {
      restaurantName: name.trim(),
      restaurantAddress: address.trim(),
      restaurantCuisine: cuisine.trim() || undefined,
      restaurantNotes: notes.trim() || undefined,
    });
    await onPush(bookmark.id);
  };

  const missingFields: string[] = [];
  if (!name.trim()) missingFields.push("name");
  if (!address.trim()) missingFields.push("address");

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {bookmark.restaurantName || "Unknown Restaurant"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {bookmark.memoryContent.length > 80
              ? bookmark.memoryContent.slice(0, 80) + "…"
              : bookmark.memoryContent}
          </p>
          {missingFields.length > 0 && (
            <p className="text-xs text-destructive mt-1">
              Missing: {missingFields.join(", ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(bookmark.id); }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Restaurant Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sushi Nakazawa"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Address *</label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 23 Commerce St, New York, NY"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cuisine</label>
            <Input
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g. Japanese, Italian"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details"
              className="h-10 rounded-xl text-sm"
            />
          </div>
          <button
            onClick={handleSaveAndPush}
            disabled={!isComplete || isPushing}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
          >
            {isPushing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                Bookmark on Google Maps
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
