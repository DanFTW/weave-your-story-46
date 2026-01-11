import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2, Check, X, Tag } from "lucide-react";
import { GeneratedMemory } from "@/types/flows";
import { Input } from "@/components/ui/input";
import { TagSelectionSheet } from "@/components/memories/TagSelectionSheet";
import { getTagById } from "@/data/tagConfig";
import { cn } from "@/lib/utils";

interface MemoryPreviewCardProps {
  memory: GeneratedMemory;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateTag?: (id: string, tag: string) => void;
  onToggleEdit: (id: string, isEditing: boolean) => void;
}

export function MemoryPreviewCard({
  memory,
  onDelete,
  onUpdate,
  onUpdateTag,
  onToggleEdit,
}: MemoryPreviewCardProps) {
  const [editValue, setEditValue] = useState(memory.content);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [0, 100], [0, 1]);
  const deleteScale = useTransform(x, [0, 100], [0.8, 1]);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onDelete(memory.id);
    }
  };

  const handleTap = () => {
    if (!memory.isEditing) {
      onToggleEdit(memory.id, true);
      setEditValue(memory.content);
    }
  };

  const handleSaveEdit = () => {
    onUpdate(memory.id, editValue);
  };

  const handleCancelEdit = () => {
    onToggleEdit(memory.id, false);
    setEditValue(memory.content);
  };

  const handleTagSelect = async (tag: string) => {
    if (onUpdateTag) {
      onUpdateTag(memory.id, tag);
    }
  };

  // Get tag config for display
  const tagConfig = memory.tag ? getTagById(memory.tag) : null;
  const TagIcon = tagConfig?.icon || Tag;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl">
        {/* Delete background */}
        <motion.div
          className="absolute inset-0 bg-destructive flex items-center justify-end pr-6 rounded-2xl"
          style={{ opacity: deleteOpacity }}
        >
          <motion.div style={{ scale: deleteScale }}>
            <Trash2 className="w-6 h-6 text-white" />
          </motion.div>
        </motion.div>

        {/* Card */}
        <motion.div
          ref={cardRef}
          drag={memory.isEditing ? false : "x"}
          dragConstraints={{ left: 0, right: 150 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          style={{ x }}
          onClick={handleTap}
          className="relative bg-card border border-border rounded-2xl p-4 cursor-pointer"
          whileTap={memory.isEditing ? {} : { scale: 0.98 }}
        >
          {memory.isEditing ? (
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="text-sm"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-foreground leading-relaxed">
                {memory.content}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {memory.entryName}
                </span>
                
                {/* Tag pill - clickable to edit */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagSheetOpen(true);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-all",
                    tagConfig
                      ? cn(tagConfig.gradient, "text-white")
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <TagIcon className="h-3 w-3" />
                  <span>{tagConfig?.label || 'Add tag'}</span>
                </button>
                
                <span className="text-xs text-muted-foreground ml-auto">
                  Swipe to delete
                </span>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Tag Selection Sheet */}
      <TagSelectionSheet
        open={tagSheetOpen}
        onOpenChange={setTagSheetOpen}
        currentTag={memory.tag}
        memoryContent={memory.content}
        onSelectTag={handleTagSelect}
      />
    </>
  );
}
