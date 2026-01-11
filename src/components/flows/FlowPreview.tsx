import { ChevronLeft, Check } from "lucide-react";
import { FlowConfig, GeneratedMemory } from "@/types/flows";
import { Button } from "@/components/ui/button";
import { MemoryPreviewCard } from "./MemoryPreviewCard";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface FlowPreviewProps {
  config: FlowConfig;
  memories: GeneratedMemory[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onUpdateTag?: (id: string, tag: string) => void;
  onToggleEdit: (id: string, isEditing: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
  isConfirming: boolean;
}

const gradientClasses: Record<string, string> = {
  blue: "thread-gradient-blue",
  teal: "thread-gradient-teal",
  purple: "thread-gradient-purple",
  orange: "thread-gradient-orange",
  pink: "thread-gradient-pink",
};

export function FlowPreview({
  config,
  memories,
  onDelete,
  onUpdate,
  onUpdateTag,
  onToggleEdit,
  onConfirm,
  onBack,
  isConfirming,
}: FlowPreviewProps) {
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className={cn("relative px-5 pt-12 pb-6", gradientClasses[config.gradient])}>
        <button
          onClick={onBack}
          className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center mb-4"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Review Memories
            </h1>
            <p className="text-white/70 text-sm">
              {memories.length} memories generated
            </p>
          </div>
        </div>
      </div>

      {/* Memory List */}
      <div className="flex-1 px-5 py-4 pb-32">
        <p className="text-sm text-muted-foreground mb-4">
          Swipe right to delete • Tap to edit
        </p>
        
        <div className="space-y-3">
          {memories.map((memory, index) => (
            <motion.div
              key={memory.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <MemoryPreviewCard
                memory={memory}
                onDelete={onDelete}
                onUpdate={onUpdate}
                onUpdateTag={onUpdateTag}
                onToggleEdit={onToggleEdit}
              />
            </motion.div>
          ))}
        </div>

        {memories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              All memories have been removed.
            </p>
          </div>
        )}
      </div>

      {/* Confirm Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-background via-background to-transparent pt-10">
        <Button
          onClick={onConfirm}
          disabled={memories.length === 0 || isConfirming}
          className="w-full h-12 text-base font-medium gap-2"
        >
          {isConfirming ? (
            "Saving..."
          ) : (
            <>
              <Check className="w-5 h-5" />
              Confirm & Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
