import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Calendar, Tag, Shield, Clock, Pencil } from "lucide-react";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
import { Memory } from "@/types/memory";
import { getTagById } from "@/data/tagConfig";
import { TagSelectionSheet } from "@/components/memories/TagSelectionSheet";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

export default function MemoryDetail() {
  const { memoryId } = useParams<{ memoryId: string }>();
  const navigate = useNavigate();
  const { listMemories, forgetMemory, changeTag, isListing, isForgetting, isChangingTag } = useLiamMemory();
  const { addDeletedId, isDeleted } = useDeletedMemories();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);

  useEffect(() => {
    async function fetchMemory() {
      // If this memory was already deleted locally, show not found
      if (memoryId && isDeleted(memoryId)) {
        setNotFound(true);
        return;
      }

      const memories = await listMemories();
      if (memories) {
        const found = memories.find((m) => m.id === memoryId);
        if (found) {
          setMemory(found);
        } else {
          setNotFound(true);
        }
      }
    }
    fetchMemory();
  }, [memoryId, isDeleted]);

  const handleForget = async () => {
    if (!memoryId) return;
    
    // Call the API with permanent: true
    const success = await forgetMemory(memoryId, true);
    
    if (success) {
      // Mark as deleted locally (persists to localStorage)
      addDeletedId(memoryId);
      navigate("/memories", { replace: true });
    }
  };

  const handleBack = () => {
    navigate("/memories");
  };

  const handleChangeTag = async (newTag: string) => {
    if (!memoryId) return;
    
    const success = await changeTag(memoryId, newTag);
    
    if (success && memory) {
      // Optimistically update the local state
      setMemory({ ...memory, tag: newTag });
    }
  };

  if (isListing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound || !memory) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center h-14 px-4 border-b border-border/30">
          <button onClick={handleBack} className="p-2 -ml-2">
            <ChevronLeft className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="flex-1 text-center text-lg font-semibold">Memory</h1>
          <div className="w-10" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Memory not found</p>
        </div>
      </div>
    );
  }

  const tagConfig = getTagById(memory.tag || memory.category);
  const Icon = tagConfig.icon;

  // Format date for display
  const formattedDate = (() => {
    try {
      return format(parseISO(memory.createdAt), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return "";
    }
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center h-14 px-4">
        <button onClick={handleBack} className="p-2 -ml-2">
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="flex-1 text-center text-lg font-semibold">Memory</h1>
        <div className="w-10" />
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-auto px-5 pb-32">
        {/* Category Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "rounded-2xl overflow-hidden p-5 relative",
            tagConfig.gradient
          )}
          style={{ minHeight: "160px" }}
        >
          {/* Decorative curved shape */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20"
            style={{
              background: "radial-gradient(ellipse at 100% 50%, rgba(255,255,255,0.3) 0%, transparent 70%)",
            }}
          />
          
          {/* Icon */}
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
            <Icon className="h-6 w-6 text-white" />
          </div>

          {/* Category Label */}
          <h2 className="text-xl font-bold text-white relative z-10">
            {tagConfig.label}
          </h2>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="mt-5"
        >
          {/* New Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">New</span>
          </div>

          {/* Memory Content */}
          <p className="text-base leading-relaxed text-foreground mt-4">
            {memory.content}
          </p>

          {/* Memory Details */}
          <div className="mt-6 space-y-3">
            {/* Date */}
            {formattedDate && (
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span className="text-foreground">{formattedDate}</span>
              </div>
            )}

            {/* Tag - Editable */}
            <div className="flex items-center gap-3 text-sm">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tag:</span>
              <button
                onClick={() => setTagSheetOpen(true)}
                disabled={isChangingTag}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all",
                  tagConfig.gradient,
                  "text-white hover:opacity-90",
                  isChangingTag && "opacity-50"
                )}
              >
                <span>{tagConfig.label}</span>
                <Pencil className="h-3 w-3" />
              </button>
            </div>

            {/* Category */}
            {memory.category && memory.category !== memory.tag && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Category:</span>
                <span className="text-foreground capitalize">{memory.category}</span>
              </div>
            )}

            {/* Sensitivity */}
            {memory.sensitivity && (
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sensitivity:</span>
                <span className="text-foreground capitalize">{memory.sensitivity}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-background">
        <div className="flex gap-3">
          <button
            onClick={handleForget}
            disabled={isForgetting}
            className={cn(
              "flex-1 h-12 rounded-xl font-semibold text-white transition-all",
              "bg-[hsl(0_84%_65%)] hover:bg-[hsl(0_84%_60%)]",
              isForgetting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isForgetting ? "Forgetting..." : "Forget Memory"}
          </button>
          <button
            onClick={handleBack}
            className="flex-1 h-12 rounded-xl font-semibold bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 transition-all hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            Done
          </button>
        </div>
      </div>

      {/* Tag Selection Sheet */}
      <TagSelectionSheet
        open={tagSheetOpen}
        onOpenChange={setTagSheetOpen}
        currentTag={memory.tag}
        memoryContent={memory.content}
        onSelectTag={handleChangeTag}
        isLoading={isChangingTag}
      />
    </div>
  );
}
