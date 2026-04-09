import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface TagRemoveDialogProps {
  tag: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tag: string, block: boolean) => void;
}

export function TagRemoveDialog({ tag, open, onOpenChange, onConfirm }: TagRemoveDialogProps) {
  const [shouldBlock, setShouldBlock] = useState(false);

  const handleConfirm = () => {
    if (!tag) return;
    onConfirm(tag, shouldBlock);
    setShouldBlock(false);
  };

  const handleCancel = () => {
    setShouldBlock(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove "{tag}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove it from your interests list and delete the underlying memory.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="block-topic"
            checked={shouldBlock}
            onCheckedChange={(checked) => setShouldBlock(checked === true)}
          />
          <label htmlFor="block-topic" className="text-sm text-muted-foreground leading-snug cursor-pointer">
            Block this topic
            <span className="block text-xs text-muted-foreground/70 mt-0.5">
              Won't reappear on future syncs
            </span>
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
