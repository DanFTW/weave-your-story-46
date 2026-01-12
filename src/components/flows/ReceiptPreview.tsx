import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Store, 
  Calendar, 
  CreditCard, 
  Receipt, 
  Check, 
  Pencil, 
  RotateCcw,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptData } from "@/hooks/useReceiptUpload";
import { cn } from "@/lib/utils";

interface ReceiptPreviewProps {
  data: ReceiptData;
  imageUrl?: string;
  onSave: (memoryString: string) => void;
  onRetake: () => void;
  isSaving: boolean;
}

export function ReceiptPreview({
  data,
  imageUrl,
  onSave,
  onRetake,
  isSaving,
}: ReceiptPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMemory, setEditedMemory] = useState(data.memoryString);

  const handleSave = () => {
    onSave(editedMemory);
  };

  const confidenceColors = {
    high: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className="space-y-5">
      {/* Receipt image thumbnail */}
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-xl overflow-hidden bg-muted max-h-32"
        >
          <img
            src={imageUrl}
            alt="Receipt"
            className="w-full h-32 object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
            <span className="text-xs text-white/80">Original receipt</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              confidenceColors[data.confidence]
            )}>
              {data.confidence} confidence
            </span>
          </div>
        </motion.div>
      )}

      {/* Main info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-card border border-border/50 overflow-hidden"
      >
        {/* Header */}
        <div className="thread-gradient-teal px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">
                {data.storeName || 'Unknown Store'}
              </h3>
              <p className="text-white/70 text-sm">
                {formatDate(data.date)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(data.total)}
            </span>
          </div>

          {/* Items list */}
          {data.items && data.items.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Items ({data.items.length})
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {data.items.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-foreground truncate flex-1 mr-2">
                      {item.name}
                    </span>
                    <span className="text-muted-foreground font-medium">
                      {formatCurrency(item.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtotal & Tax */}
          {(data.subtotal || data.tax) && (
            <div className="border-t border-border pt-3 space-y-1">
              {data.subtotal !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(data.subtotal)}</span>
                </div>
              )}
              {data.tax !== null && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">{formatCurrency(data.tax)}</span>
                </div>
              )}
            </div>
          )}

          {/* Payment method */}
          {data.paymentMethod && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Paid with</span>
              <span className="font-medium text-foreground">{data.paymentMethod}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Memory preview/edit */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Memory to save</p>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-primary flex items-center gap-1 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
        
        {isEditing ? (
          <Textarea
            value={editedMemory}
            onChange={(e) => setEditedMemory(e.target.value)}
            className="min-h-[80px] text-sm"
            placeholder="Edit the memory text..."
          />
        ) : (
          <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
            <p className="text-sm text-foreground leading-relaxed">
              {editedMemory}
            </p>
          </div>
        )}
      </motion.div>

      {/* Low confidence warning */}
      {data.confidence === 'low' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Some details may be inaccurate due to image quality. Please review before saving.
          </p>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onRetake}
          disabled={isSaving}
          className="flex-1 h-12 gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Retake
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !editedMemory.trim()}
          className="flex-1 h-12 gap-2 thread-gradient-teal border-0 text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save Memory
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
