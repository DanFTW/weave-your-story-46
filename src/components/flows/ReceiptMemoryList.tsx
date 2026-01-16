import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion } from "framer-motion";
import { Receipt, Plus, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { format, parseISO } from "date-fns";

interface Memory {
  id: string;
  content: string;
  tag?: string;
  createdAt: string;
}

export interface ReceiptMemoryListHandle {
  addOptimisticMemory: (content: string) => void;
  refresh: () => Promise<void>;
}

interface ReceiptMemoryListProps {
  onAddNew: () => void;
}

export const ReceiptMemoryList = forwardRef<ReceiptMemoryListHandle, ReceiptMemoryListProps>(
  function ReceiptMemoryList({ onAddNew }, ref) {
    const { listMemories, isListing } = useLiamMemory();
    const [memories, setMemories] = useState<Memory[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);

    const fetchMemories = useCallback(async () => {
      const result = await listMemories();
      if (result) {
        // Filter to only receipt memories
        const receiptMemories = result.filter(
          (m) => m.tag?.toLowerCase() === 'receipts' || m.tag?.toLowerCase() === 'receipt'
        );
        setMemories(receiptMemories);
      }
      setHasLoaded(true);
    }, [listMemories]);

    // Add optimistic memory for instant UI feedback
    const addOptimisticMemory = useCallback((content: string) => {
      const optimisticMemory: Memory = {
        id: `optimistic-${Date.now()}`,
        content,
        tag: 'RECEIPTS',
        createdAt: new Date().toISOString(),
      };
      setMemories(prev => [optimisticMemory, ...prev]);
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      addOptimisticMemory,
      refresh: fetchMemories,
    }), [addOptimisticMemory, fetchMemories]);

    useEffect(() => {
      fetchMemories();
    }, [fetchMemories]);

  // Parse receipt memory to extract store name and amount
  const parseReceiptMemory = (content: string) => {
    // Pattern: "[Name] spent $[amount] at [store] on [date]..."
    const amountMatch = content.match(/\$[\d,]+\.?\d*/);
    const storeMatch = content.match(/at (.+?) on/i);
    
    return {
      amount: amountMatch?.[0] || null,
      store: storeMatch?.[1] || null,
    };
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  // Loading state
  if (isListing && !hasLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        <p className="text-muted-foreground">Loading receipts...</p>
      </div>
    );
  }

  // Empty state
  if (hasLoaded && memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <Receipt className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            No receipts yet
          </h3>
          <p className="text-muted-foreground text-sm max-w-[240px]">
            Scan your first receipt to start tracking your purchases.
          </p>
        </div>
        <Button
          onClick={onAddNew}
          className="gap-2 thread-gradient-teal border-0 text-white"
        >
          <Plus className="w-4 h-4" />
          Scan Your First Receipt
        </Button>
      </div>
    );
  }

  // List of receipt memories
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {memories.length} receipt{memories.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Memory list */}
      <div className="space-y-3">
        {memories.map((memory, index) => {
          const { amount, store } = parseReceiptMemory(memory.content);
          
          return (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-xl bg-card border border-border/50 overflow-hidden"
            >
              {/* Card header */}
              <div className="thread-gradient-teal px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Store className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {store || 'Receipt'}
                    </p>
                  </div>
                  {amount && (
                    <span className="text-white font-semibold text-sm">
                      {amount}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Card body */}
              <div className="px-3 py-2.5">
                <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                  {memory.content}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {formatDate(memory.createdAt)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add new button - Fixed at bottom */}
      <div className="fixed bottom-24 right-5 z-10">
        <Button
          onClick={onAddNew}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg thread-gradient-teal border-0 text-white"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
});
