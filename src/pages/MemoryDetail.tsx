import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Calendar, Tag, Shield, Clock, Pencil, Mail, ArrowUpRight, ArrowDownLeft, ExternalLink, Facebook } from "lucide-react";
import { useLiamMemory } from "@/hooks/useLiamMemory";
import { useDeletedMemories } from "@/hooks/useDeletedMemories";
import { Memory } from "@/types/memory";
import { getTagById } from "@/data/tagConfig";
import { TagSelectionSheet } from "@/components/memories/TagSelectionSheet";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { consolidateInstagramMemories } from "@/utils/consolidateInstagramMemories";
import { supabase } from "@/integrations/supabase/client";

// Parse email content into structured parts
function parseEmailContent(content: string): {
  direction: 'incoming' | 'outgoing';
  contact: string;
  date: string;
  subject: string;
  body: string;
} | null {
  // Match: Email from <contact> on <date>: "<subject>" - <body>
  const incomingMatch = content.match(/^Email from (.+?) on (.+?): "(.+?)" - ([\s\S]*)$/);
  if (incomingMatch) {
    return {
      direction: 'incoming',
      contact: incomingMatch[1],
      date: incomingMatch[2],
      subject: incomingMatch[3],
      body: incomingMatch[4],
    };
  }
  
  // Match: Email sent to <contact> on <date>: "<subject>" - <body>
  const outgoingMatch = content.match(/^Email sent to (.+?) on (.+?): "(.+?)" - ([\s\S]*)$/);
  if (outgoingMatch) {
    return {
      direction: 'outgoing',
      contact: outgoingMatch[1],
      date: outgoingMatch[2],
      subject: outgoingMatch[3],
      body: outgoingMatch[4],
    };
  }
  
  return null;
}

// Component to display formatted email content
function EmailContent({ content }: { content: string }) {
  const parsed = parseEmailContent(content);
  
  if (!parsed) {
    // Fallback to plain text if parsing fails
    return (
      <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
      </p>
    );
  }
  
  const DirectionIcon = parsed.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight;
  const directionLabel = parsed.direction === 'incoming' ? 'From' : 'To';
  const directionColor = parsed.direction === 'incoming' 
    ? 'text-cyan-600 dark:text-cyan-400' 
    : 'text-blue-600 dark:text-blue-400';
  
  return (
    <div className="space-y-4">
      {/* Direction Badge */}
      <div className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full",
        parsed.direction === 'incoming' 
          ? "bg-cyan-100 dark:bg-cyan-900/30" 
          : "bg-blue-100 dark:bg-blue-900/30"
      )}>
        <DirectionIcon className={cn("h-3.5 w-3.5", directionColor)} />
        <span className={cn("text-xs font-medium", directionColor)}>
          {parsed.direction === 'incoming' ? 'Incoming Email' : 'Outgoing Email'}
        </span>
      </div>
      
      {/* Email Header */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-sm text-muted-foreground min-w-[50px]">{directionLabel}:</span>
          <span className="text-sm text-foreground font-medium">{parsed.contact}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-sm text-muted-foreground min-w-[50px]">Date:</span>
          <span className="text-sm text-foreground">{parsed.date}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-sm text-muted-foreground min-w-[50px]">Subject:</span>
          <span className="text-sm text-foreground font-medium">{parsed.subject}</span>
        </div>
      </div>
      
      {/* Email Body */}
      <div className="rounded-xl border border-border/50 p-4">
        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
          <Mail className="h-4 w-4" />
          Message
        </p>
        <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
          {parsed.body}
        </p>
      </div>
    </div>
  );
}

export default function MemoryDetail() {
  const { memoryId } = useParams<{ memoryId: string }>();
  const navigate = useNavigate();
  const { listMemories, forgetMemory, changeTag, isListing, isForgetting, isChangingTag } = useLiamMemory();
  const { addDeletedId, isDeleted } = useDeletedMemories();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMemory() {
      // If this memory was already deleted locally, show not found
      if (memoryId && isDeleted(memoryId)) {
        setNotFound(true);
        return;
      }

      const rawMemories = await listMemories();
      if (rawMemories) {
        // Apply consolidation to get the same view as the Memories page
        const consolidatedMemories = consolidateInstagramMemories(rawMemories);
        
        // First, try direct ID match
        let found = consolidatedMemories.find((m) => m.id === memoryId);
        
        // If not found, check if memoryId was a fragment that got merged
        if (!found) {
          found = consolidatedMemories.find((m) => 
            m._fragmentIds?.includes(memoryId!)
          );
        }
        
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
          <div className="mt-4">
            {memory.category?.toLowerCase() === 'email' || memory.tag?.toLowerCase() === 'email' ? (
              <EmailContent content={memory.content} />
            ) : (
              <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                {memory.content}
              </p>
            )}
          </div>

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

            {/* Facebook reference URL */}
            {facebookUrl && (
              <div className="flex items-center gap-3 text-sm">
                <Facebook className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Source:</span>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  View on Facebook
                  <ExternalLink className="h-3 w-3" />
                </a>
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
