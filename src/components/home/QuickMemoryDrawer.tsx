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
import { Loader2 } from 'lucide-react';

interface QuickMemoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (content: string) => Promise<boolean>;
  isSaving: boolean;
}

/**
 * Slide-up drawer for quickly adding memories
 * Contains a textarea for memory input and a save button
 */
export function QuickMemoryDrawer({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: QuickMemoryDrawerProps) {
  const [content, setContent] = useState('');

  const handleSave = async () => {
    if (!content.trim()) return;
    
    const success = await onSave(content.trim());
    if (success) {
      setContent('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setContent('');
    }
    onOpenChange(newOpen);
  };

  return (
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
  );
}
