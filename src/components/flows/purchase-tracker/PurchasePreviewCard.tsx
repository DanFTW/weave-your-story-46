import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2, Receipt } from "lucide-react";
import { PurchaseMemory } from "@/types/purchaseTracker";
import { cn } from "@/lib/utils";

interface PurchasePreviewCardProps {
  memory: PurchaseMemory;
  onDelete: (id: string) => void;
}

export function PurchasePreviewCard({ memory, onDelete }: PurchasePreviewCardProps) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-150, -50], [1, 0]);
  const deleteScale = useTransform(x, [-150, -50], [1, 0.8]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -100) {
      onDelete(memory.id);
    }
  };

  const { vendor, amount, date, subject } = memory.purchase;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background (swipe left) */}
      <motion.div
        className="absolute inset-y-0 right-0 w-24 bg-destructive flex items-center justify-center rounded-r-2xl"
        style={{ opacity: deleteOpacity }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="w-5 h-5 text-white" />
        </motion.div>
      </motion.div>

      {/* Card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              "bg-gradient-to-r from-green-500 to-emerald-500"
            )}>
              <Receipt className="w-5 h-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Vendor and amount row */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {vendor}
                </p>
                <span className="text-sm font-semibold text-foreground flex-shrink-0">
                  {amount}
                </span>
              </div>

              {/* Subject */}
              <p className="text-sm text-muted-foreground truncate mb-1">
                {subject}
              </p>

              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {date}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
