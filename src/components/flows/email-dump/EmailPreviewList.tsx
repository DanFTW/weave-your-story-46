import { ChevronLeft, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailMemory } from "@/types/emailDump";
import { MemoryPreviewCard } from "@/components/flows/MemoryPreviewCard";
import { motion, AnimatePresence } from "framer-motion";

interface EmailPreviewListProps {
  emails: EmailMemory[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateTag: (id: string, tag: string) => void;
  onToggleEdit: (id: string, isEditing: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
  isSaving: boolean;
}

export function EmailPreviewList({
  emails,
  onDelete,
  onUpdate,
  onUpdateTag,
  onToggleEdit,
  onConfirm,
  onBack,
  isSaving,
}: EmailPreviewListProps) {
  // Convert EmailMemory to the format expected by MemoryPreviewCard
  const memoriesForPreview = emails.map(email => ({
    id: email.id,
    content: email.content,
    tag: email.tag,
    entryId: 'email-dump',
    entryName: email.email.from,
    isEditing: email.isEditing,
  }));

  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">
      {/* Back button and title */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Email count */}
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {emails.length} {emails.length === 1 ? 'email' : 'emails'} ready to save
        </p>
      </div>

      {/* Emails list */}
      <div className="flex-1 space-y-3 pb-24">
        <AnimatePresence mode="popLayout">
          {memoriesForPreview.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.2 }}
            >
              <MemoryPreviewCard
                memory={memory}
                onDelete={() => onDelete(memory.id)}
                onUpdate={(_id: string, content: string) => onUpdate(memory.id, content)}
                onUpdateTag={(_id: string, tag: string) => onUpdateTag(memory.id, tag)}
                onToggleEdit={(_id: string, isEditing: boolean) => onToggleEdit(memory.id, isEditing)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <Button
          onClick={onConfirm}
          disabled={emails.length === 0 || isSaving}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              Save {emails.length} {emails.length === 1 ? 'Memory' : 'Memories'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
