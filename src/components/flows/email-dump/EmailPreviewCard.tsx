import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Trash2, ChevronDown, ChevronUp, Mail } from "lucide-react";
import { EmailMemory, ExtractedEmail } from "@/types/emailDump";
import { getTagById } from "@/data/tagConfig";
import { cn } from "@/lib/utils";

interface EmailPreviewCardProps {
  memory: EmailMemory;
  onDelete: (id: string) => void;
}

function extractSenderName(from: string): string {
  // Extract name from "Name <email>" format
  const match = from.match(/^([^<]+)</);
  if (match) {
    return match[1].trim();
  }
  // If no name, extract part before @
  const emailMatch = from.match(/([^@]+)@/);
  return emailMatch ? emailMatch[1] : from;
}

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSnippetText(email: ExtractedEmail): string {
  // Handle snippet which may be an object
  let text = email.body || email.snippet || '';
  
  if (typeof text === 'object' && text !== null) {
    // @ts-ignore
    text = text.body || text.text || '';
  }
  
  return String(text).replace(/\s+/g, ' ').trim();
}

export function EmailPreviewCard({ memory, onDelete }: EmailPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-150, -50], [1, 0]);
  const deleteScale = useTransform(x, [-150, -50], [1, 0.8]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -100) {
      onDelete(memory.id);
    }
  };

  const email = memory.email;
  const senderName = extractSenderName(email.from);
  const senderEmail = extractEmail(email.from);
  const dateStr = formatDate(email.date);
  const snippetText = getSnippetText(email);
  const tagConfig = getTagById(memory.tag);

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
        {/* Main content - always visible */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              tagConfig.gradient
            )}>
              <Mail className="w-5 h-5 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Sender and date row */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-medium text-sm text-foreground truncate">
                  {senderName}
                </p>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {dateStr}
                </span>
              </div>

              {/* Subject */}
              <p className="text-sm text-foreground font-medium truncate mb-1">
                {email.subject}
              </p>

              {/* Snippet preview (collapsed) */}
              {!isExpanded && snippetText && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {snippetText}
                </p>
              )}
            </div>

            {/* Expand indicator */}
            <button 
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        <motion.div
          initial={false}
          animate={{ 
            height: isExpanded ? 'auto' : 0,
            opacity: isExpanded ? 1 : 0 
          }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4 pt-0">
            <div className="border-t border-border pt-3">
              {/* Full sender info */}
              <p className="text-xs text-muted-foreground mb-2">
                From: {senderEmail}
              </p>

              {/* Full body */}
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {snippetText || "No content available"}
                </p>
              </div>

              {/* Tag pill */}
              <div className="flex items-center justify-between mt-3">
                <div className={cn(
                  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
                  tagConfig.gradient, "text-white"
                )}>
                  <tagConfig.icon className="w-3 h-3" />
                  <span>{tagConfig.label}</span>
                </div>
                
                <span className="text-xs text-muted-foreground">
                  ← Swipe to delete
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
