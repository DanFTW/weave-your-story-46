import { ChevronLeft, ArrowRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseMemory } from "@/types/purchaseTracker";
import { PurchasePreviewCard } from "./PurchasePreviewCard";
import { motion, AnimatePresence } from "framer-motion";

interface PurchasePreviewListProps {
  purchases: PurchaseMemory[];
  savedCount: number;
  onDelete: (id: string) => void;
  onDone: () => void;
  onBack: () => void;
}

export function PurchasePreviewList({
  purchases,
  savedCount,
  onDelete,
  onDone,
  onBack,
}: PurchasePreviewListProps) {
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

      {/* Count header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Receipt className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {savedCount} {savedCount === 1 ? 'purchase' : 'purchases'} saved as memories
          </p>
          <p className="text-xs text-muted-foreground">
            Swipe left to remove from list
          </p>
        </div>
      </div>

      {/* Purchases list */}
      <div className="flex-1 space-y-3 pb-28 overflow-x-hidden">
        <AnimatePresence mode="popLayout">
          {purchases.map((memory) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -200, transition: { duration: 0.2 } }}
              layout
            >
              <PurchasePreviewCard
                memory={memory}
                onDelete={onDelete}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {purchases.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">
              No purchases to display
            </p>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pb-safe">
        <Button
          onClick={onDone}
          className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
        >
          Done
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
