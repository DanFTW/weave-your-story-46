import { ChevronLeft, ArrowRight, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailMemory } from "@/types/emailDump";
import { EmailPreviewCard } from "./EmailPreviewCard";
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
  onConfirm,
  onBack,
  isSaving,
}: EmailPreviewListProps) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-200px)]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4 -ml-1"
      >
        <ChevronLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Email count header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {emails.length} {emails.length === 1 ? 'email' : 'emails'} ready to save
          </p>
          <p className="text-xs text-muted-foreground">
            Tap to expand, swipe left to delete
          </p>
        </div>
      </div>

      {/* Emails list */}
      <div className="flex-1 space-y-3 pb-28 overflow-x-hidden">
        <AnimatePresence mode="popLayout">
          {emails.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
              layout
            >
              <EmailPreviewCard
                memory={memory}
                onDelete={onDelete}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {emails.length === 0 && (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">
              No emails to save
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <Button
          onClick={onConfirm}
          disabled={emails.length === 0 || isSaving}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
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
