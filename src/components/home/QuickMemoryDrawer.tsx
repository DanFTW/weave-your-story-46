import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Tag } from 'lucide-react';
import { TagSelectionSheet } from '@/components/memories/TagSelectionSheet';
import { getTagById } from '@/data/tagConfig';
import { cn } from '@/lib/utils';

interface QuickMemoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (content: string, tag?: string) => Promise<boolean>;
  isSaving: boolean;
}

/**
 * Slide-up drawer for quickly adding memories
 * Contains a textarea for memory input, tag selection, and a save button
 */
export function QuickMemoryDrawer({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: QuickMemoryDrawerProps) {
  const [content, setContent] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [tagSheetOpen, setTagSheetOpen] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    
    const success = await onSave(content.trim(), selectedTag);
    if (success) {
      setContent('');
      setSelectedTag(undefined);
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setContent('');
      setSelectedTag(undefined);
    }
    onOpenChange(newOpen);
  };

  const handleSelectTag = async (tag: string) => {
    setSelectedTag(tag);
  };

  const tagConfig = selectedTag ? getTagById(selectedTag) : null;
  const TagIcon = tagConfig?.icon;

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="px-4 pb-8">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-xl font-semibold">Quick Memory</DrawerTitle>
          </DrawerHeader>
          
          <div className="space-y-4">
            <Textarea
              placeholder="What do you want to remember?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none text-base"
              autoFocus
            />

            {/* Tag Selection */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTagSheetOpen(true)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all",
                  selectedTag && tagConfig
                    ? cn(tagConfig.gradient, "text-white")
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {TagIcon ? (
                  <TagIcon className="h-3.5 w-3.5" />
                ) : (
                  <Tag className="h-3.5 w-3.5" />
                )}
                <span>{tagConfig?.label || 'Add Tag'}</span>
              </button>
              
              {selectedTag && (
                <button
                  type="button"
                  onClick={() => setSelectedTag(undefined)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <DrawerFooter className="px-0 pt-4">
            <Button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="w-full h-12 text-base font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Memory'
              )}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <TagSelectionSheet
        open={tagSheetOpen}
        onOpenChange={setTagSheetOpen}
        currentTag={selectedTag}
        memoryContent={content}
        onSelectTag={handleSelectTag}
      />
    </>
  );
}
